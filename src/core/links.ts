import type { NoteLink } from './types';

/**
 * Matches the target part of a Joplin internal link or image: `](:/<32 hex>#anchor)`.
 * Group 1 is the item id (a note or a resource), group 2 the optional anchor.
 * An optional link title (`](:/id "title")`) is tolerated and ignored.
 */
const ITEM_LINK = /\]\(:\/([0-9a-f]{32})(?:#([^)\s]+))?(?:\s+"[^"]*")?\)/g;

/** Every `:/id` link in the body, in order of appearance. */
export function extractLinks(body: string): NoteLink[] {
	return Array.from(body.matchAll(ITEM_LINK), (m) => ({
		targetId: m[1],
		anchor: m[2] ?? null,
		index: m.index ?? 0,
	}));
}

/**
 * Distinct ids of OTHER notes in `scope` that `body` links to, in order of first
 * appearance. Self-links and links to resources or out-of-scope notes are dropped.
 */
export function linkedNoteIds(noteId: string, body: string, scope: ReadonlySet<string>): string[] {
	const seen = new Set<string>();
	for (const link of extractLinks(body)) {
		if (link.targetId !== noteId && scope.has(link.targetId)) seen.add(link.targetId);
	}
	return [...seen];
}
