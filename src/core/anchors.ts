import type { NoteRecord } from './types';

/** Note Link System element ids: `## Heading {#h-state}`. */
const ELEMENT_ID = /\{#([A-Za-z][\w:.-]*)\}/g;

const shortId = (noteId: string) => noteId.slice(0, 8);

/** Anchor of the chapter itself, used when a link names a note but no element. */
export const noteAnchor = (noteId: string) => `n-${shortId(noteId)}`;

export function elementIds(body: string): string[] {
	return Array.from(body.matchAll(ELEMENT_ID), (m) => m[1]);
}

/**
 * Final element ids for every note in one book.
 *
 * Ids are kept as written unless two notes in the book use the same one; only
 * then are both prefixed with their note's short id. HTML puts every chapter on
 * one page, so a clash there would make links jump to the wrong note.
 */
export class AnchorPlan {
	private readonly finalIds: ReadonlyMap<string, string>;

	constructor(notes: readonly NoteRecord[]) {
		const owners = new Map<string, number>();
		for (const note of notes) {
			for (const id of new Set(elementIds(note.body))) owners.set(id, (owners.get(id) ?? 0) + 1);
		}
		const entries: [string, string][] = [];
		for (const note of notes) {
			for (const id of new Set(elementIds(note.body))) {
				const clash = (owners.get(id) ?? 0) > 1;
				// The `n` keeps the id a valid XML name (it must not start with a digit) for EPUB.
				entries.push([`${note.id}#${id}`, clash ? `n${shortId(note.id)}-${id}` : id]);
			}
		}
		this.finalIds = new Map(entries);
	}

	/** The id to emit for `anchor` in `noteId`; falls back to the chapter anchor when the element is unknown. */
	resolve(noteId: string, anchor: string | null): string {
		if (!anchor) return noteAnchor(noteId);
		return this.finalIds.get(`${noteId}#${anchor}`) ?? noteAnchor(noteId);
	}

	/** Body with each `{#id}` replaced by its final id. */
	applyTo(note: NoteRecord): string {
		return note.body.replace(ELEMENT_ID, (_m, id: string) => `{#${this.finalIds.get(`${note.id}#${id}`) ?? id}}`);
	}
}
