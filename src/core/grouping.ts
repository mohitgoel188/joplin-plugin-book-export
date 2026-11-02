import { linkedNoteIds } from './links';
import type { Book, GroupingMode, NotebookRecord, NoteRecord } from './types';

export const UNLINKED_TITLE = 'Unlinked notes';

type Graph = ReadonlyMap<string, readonly string[]>;

/** Outgoing links between notes in scope, keyed by note id, in order of first appearance. */
export function buildLinkGraph(notes: readonly NoteRecord[]): Graph {
	const scope = new Set(notes.map((n) => n.id));
	return new Map(notes.map((n) => [n.id, linkedNoteIds(n.id, n.body, scope)]));
}

function incoming(graph: Graph): Map<string, string[]> {
	const result = new Map<string, string[]>([...graph.keys()].map((id) => [id, []]));
	for (const [from, targets] of graph) {
		for (const to of targets) result.get(to)?.push(from);
	}
	return result;
}

/**
 * Connected components of the link graph, treating every link as two-way, so a
 * note that only receives links still joins its set and chains (A-B-C) form one set.
 */
export function linkedComponents(notes: readonly NoteRecord[], graph: Graph): string[][] {
	const inbound = incoming(graph);
	const seen = new Set<string>();
	const components: string[][] = [];
	for (const note of notes) {
		if (seen.has(note.id)) continue;
		const component: string[] = [];
		const stack = [note.id];
		seen.add(note.id);
		while (stack.length) {
			const id = stack.pop() as string;
			component.push(id);
			for (const next of [...(graph.get(id) ?? []), ...(inbound.get(id) ?? [])]) {
				if (!seen.has(next)) {
					seen.add(next);
					stack.push(next);
				}
			}
		}
		components.push(component);
	}
	return components;
}

const byTitle = (a: NoteRecord, b: NoteRecord) => a.title.localeCompare(b.title);

/**
 * Chapter order for one linked set: the hub first (most distinct outgoing links,
 * then most incoming, then title), then breadth-first following each note's links
 * in the order they appear in its body. Notes reached only by incoming links come
 * after a note's own outgoing ones, sorted by title.
 */
export function orderComponent(ids: readonly string[], notesById: ReadonlyMap<string, NoteRecord>, graph: Graph): NoteRecord[] {
	const members = new Set(ids);
	const inbound = incoming(graph);
	const out = (id: string) => (graph.get(id) ?? []).filter((t) => members.has(t));
	const inn = (id: string) => (inbound.get(id) ?? []).filter((t) => members.has(t));
	const notes = ids.map((id) => notesById.get(id) as NoteRecord);

	const hub = [...notes].sort(
		(a, b) => out(b.id).length - out(a.id).length || inn(b.id).length - inn(a.id).length || byTitle(a, b),
	)[0];

	const ordered: string[] = [];
	const seen = new Set([hub.id]);
	const queue = [hub.id];
	while (queue.length) {
		const id = queue.shift() as string;
		ordered.push(id);
		const viaIncoming = inn(id)
			.map((i) => notesById.get(i) as NoteRecord)
			.sort(byTitle)
			.map((n) => n.id);
		for (const next of [...out(id), ...viaIncoming]) {
			if (!seen.has(next)) {
				seen.add(next);
				queue.push(next);
			}
		}
	}
	return ordered.map((id) => notesById.get(id) as NoteRecord);
}

function notebookTitle(notebooks: readonly NotebookRecord[], id: string): string {
	return notebooks.find((nb) => nb.id === id)?.title ?? '';
}

/** One "Unlinked notes" book per notebook; a notebook with a single unlinked note gets that note's title. */
function unlinkedBooks(singles: readonly NoteRecord[], notebooks: readonly NotebookRecord[]): Book[] {
	const byNotebook = new Map<string, NoteRecord[]>();
	for (const note of singles) byNotebook.set(note.parentId, [...(byNotebook.get(note.parentId) ?? []), note]);
	return [...byNotebook.entries()].map(([notebookId, notes]) => {
		const sorted = [...notes].sort(byTitle);
		if (sorted.length === 1) return { title: sorted[0].title, kind: 'single', notes: sorted };
		const nbTitle = notebookTitle(notebooks, notebookId);
		return { title: nbTitle ? `${UNLINKED_TITLE} — ${nbTitle}` : UNLINKED_TITLE, kind: 'unlinked', notes: sorted };
	});
}

/**
 * Split the notes in scope into books.
 *
 * - `linked` (default): each linked set is one book titled after its hub; notes
 *   with no links in scope are gathered into one "Unlinked notes" book per notebook.
 * - `whole`: everything in one book — linked sets first (largest first), then unlinked notes.
 * - `perNote`: one book per note.
 */
export function groupIntoBooks(
	notes: readonly NoteRecord[],
	notebooks: readonly NotebookRecord[],
	mode: GroupingMode,
	wholeTitle = 'Notes',
): Book[] {
	if (mode === 'perNote') return [...notes].sort(byTitle).map((n) => ({ title: n.title, kind: 'single', notes: [n] }));

	const graph = buildLinkGraph(notes);
	const notesById = new Map(notes.map((n) => [n.id, n]));
	const components = linkedComponents(notes, graph);
	const linked = components
		.filter((c) => c.length > 1)
		.map((c) => orderComponent(c, notesById, graph))
		.sort((a, b) => b.length - a.length || byTitle(a[0], b[0]));
	const singles = components.filter((c) => c.length === 1).map((c) => notesById.get(c[0]) as NoteRecord);

	if (mode === 'whole') {
		return [{ title: wholeTitle, kind: 'whole', notes: [...linked.flat(), ...[...singles].sort(byTitle)] }];
	}
	return [...linked.map((ns): Book => ({ title: ns[0].title, kind: 'linked', notes: ns })), ...unlinkedBooks(singles, notebooks)];
}
