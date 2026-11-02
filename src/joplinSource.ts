import joplin from 'api';
import type { BookSources, Resource } from './core/sources';
import type { NotebookRecord, NoteRecord } from './core/types';

const NOTE_FIELDS = ['id', 'title', 'body', 'parent_id', 'user_updated_time'];
const FOLDER_FIELDS = ['id', 'title', 'parent_id'];

type Row = Record<string, string>;

async function getAll(path: string[], fields: string[]): Promise<Row[]> {
	const rows: Row[] = [];
	for (let page = 1; ; page++) {
		const result = await joplin.data.get(path, { fields, page, limit: 100 });
		rows.push(...result.items);
		if (!result.has_more) return rows;
	}
}

const toNote = (r: Row): NoteRecord => ({
	id: r.id,
	title: r.title,
	body: r.body ?? '',
	parentId: r.parent_id,
	updatedTime: Number(r.user_updated_time) || undefined,
});

/** The same notes with their tag titles attached (one data-API call per note). */
async function withTags(notes: readonly NoteRecord[]): Promise<NoteRecord[]> {
	const tagged: NoteRecord[] = [];
	for (const note of notes) {
		const tags = (await getAll(['notes', note.id, 'tags'], ['title'])).map((t) => t.title);
		tagged.push({ ...note, tags });
	}
	return tagged;
}
const toNotebook = (r: Row): NotebookRecord => ({ id: r.id, title: r.title, parentId: r.parent_id });

export interface Scope {
	readonly notes: readonly NoteRecord[];
	readonly notebooks: readonly NotebookRecord[];
}

export async function allNotebooks(): Promise<NotebookRecord[]> {
	return (await getAll(['folders'], FOLDER_FIELDS)).map(toNotebook);
}

function descendants(rootId: string, notebooks: readonly NotebookRecord[]): string[] {
	const children = notebooks.filter((nb) => nb.parentId === rootId).map((nb) => nb.id);
	return [rootId, ...children.flatMap((id) => descendants(id, notebooks))];
}

/** Every note in a notebook, optionally including its sub-notebooks. */
export async function notebookScope(folderId: string, includeSubNotebooks: boolean): Promise<Scope> {
	const notebooks = await allNotebooks();
	const ids = includeSubNotebooks ? descendants(folderId, notebooks) : [folderId];
	const notes: NoteRecord[] = [];
	for (const id of ids) notes.push(...(await getAll(['folders', id, 'notes'], NOTE_FIELDS)).map(toNote));
	return { notes: await withTags(notes), notebooks: notebooks.filter((nb) => ids.includes(nb.id)) };
}

/** The given notes and the notebooks that hold them. */
export async function notesScope(noteIds: readonly string[]): Promise<Scope> {
	const notes: NoteRecord[] = [];
	for (const id of noteIds) notes.push(toNote(await joplin.data.get(['notes', id], { fields: NOTE_FIELDS })));
	const parents = new Set(notes.map((n) => n.parentId));
	return { notes: await withTags(notes), notebooks: (await allNotebooks()).filter((nb) => parents.has(nb.id)) };
}

/** Attachments and outside-note titles from the Joplin data API. Diagrams come from `renderMermaid`. */
export function joplinBookSources(renderMermaid: BookSources['renderMermaid']): BookSources {
	const fs = joplin.require('fs-extra');
	return {
		async loadResource(id: string): Promise<Resource | null> {
			let meta: Row;
			try {
				meta = await joplin.data.get(['resources', id], { fields: ['id', 'mime', 'file_extension'] });
			} catch {
				return null; // Not an attachment: the id belongs to a note outside the book.
			}
			try {
				const data: Uint8Array = await fs.readFile(await joplin.data.resourcePath(id));
				return { id, mime: meta.mime, extension: meta.file_extension || meta.mime.split('/')[1] || 'bin', data };
			} catch (error) {
				console.error(`[book-export] could not read attachment ${id}:`, error);
				return null;
			}
		},
		async noteTitle(id: string): Promise<string | undefined> {
			try {
				return (await joplin.data.get(['notes', id], { fields: ['title'] })).title;
			} catch {
				return undefined;
			}
		},
		renderMermaid,
	};
}
