import { headingElementId, sluggedHeadingTexts, uniqueSlugs } from './slugs';
import type { NoteRecord } from './types';

/** Note Link System element ids: `## Heading {#h-state}`. */
const ELEMENT_ID = /\{#([A-Za-z][\w:.-]*)\}/g;

/** `[text](#anchor)` or `[text](#anchor "title")`, not an image. Group 1 text, 2 anchor, 3 title. */
const LOCAL_LINK = /(?<!!)\[([^\]]*)\]\(#([^)\s]+)(\s+"[^"]*")?\)/g;

const shortId = (noteId: string) => noteId.slice(0, 8);

const safeDecode = (s: string) => {
	try {
		return decodeURIComponent(s);
	} catch {
		return s;
	}
};

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
	/** `noteId#slug` → element id of a heading Joplin would slug (no `{#id}` of its own). */
	private readonly slugIds: ReadonlyMap<string, string>;

	constructor(notes: readonly NoteRecord[]) {
		this.slugIds = new Map(
			notes.flatMap((note) =>
				uniqueSlugs(sluggedHeadingTexts(note.body)).map((slug): [string, string] => [
					`${note.id}#${slug}`,
					headingElementId(noteAnchor(note.id), slug),
				]),
			),
		);
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

	/**
	 * The id to emit for `anchor` in `noteId`: a `{#id}` element first, then a heading
	 * slug; falls back to the chapter anchor when neither exists.
	 */
	resolve(noteId: string, anchor: string | null): string {
		if (!anchor) return noteAnchor(noteId);
		const key = `${noteId}#${anchor}`;
		const decoded = `${noteId}#${safeDecode(anchor)}`;
		return this.finalIds.get(key) ?? this.slugIds.get(key) ?? this.slugIds.get(decoded) ?? noteAnchor(noteId);
	}

	/** `[x](#anchor)` links inside a note, pointed at that note's final ids. */
	rewriteLocalLinks(noteId: string, body: string): string {
		return body.replace(LOCAL_LINK, (_m, text: string, anchor: string, title: string | undefined) => `[${text}](#${this.resolve(noteId, anchor)}${title ?? ''})`);
	}

	/** Body with each `{#id}` replaced by its final id. */
	applyTo(note: NoteRecord): string {
		return note.body.replace(ELEMENT_ID, (_m, id: string) => `{#${this.finalIds.get(`${note.id}#${id}`) ?? id}}`);
	}
}
