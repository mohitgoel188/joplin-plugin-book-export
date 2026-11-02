import { AnchorPlan } from './anchors';

/** `[text](:/id#anchor)` that is not an image. Group 1 text, 2 id, 3 anchor. */
const NOTE_LINK = /(?<!!)\[([^\]]*)\]\(:\/([0-9a-f]{32})(?:#([^)\s]+))?(?:\s+"[^"]*")?\)/g;

export interface LinkTargets {
	/** Note id → chapter file inside the book ('' when all chapters share one page). */
	readonly chapterFile: ReadonlyMap<string, string>;
	readonly anchors: AnchorPlan;
	/** Ids that are Joplin resources (attachments); their links are left for the resource step. */
	readonly resourceIds: ReadonlySet<string>;
	/** Title of a note outside the book, if known. */
	readonly outsideTitle: (noteId: string) => string | undefined;
	/** How to treat a link to a note that is not in this book. */
	readonly outside: 'joplinUrl' | 'plainText';
}

export const joplinNoteUrl = (noteId: string) => `joplin://x-callback-url/openNote?id=${noteId}`;

function outsideLink(text: string, noteId: string, targets: LinkTargets): string {
	if (targets.outside === 'joplinUrl') return `[${text}](${joplinNoteUrl(noteId)})`;
	const title = targets.outsideTitle(noteId);
	return title && title !== text ? `${text} (Joplin: ${title})` : text;
}

/**
 * Rewrite every internal note link in `body` (a note in the book being built).
 *
 * In-book links become `<chapterFile>#<anchor>`; links to notes outside the book
 * follow `targets.outside`; resource links are left untouched.
 */
export function rewriteNoteLinks(body: string, targets: LinkTargets): string {
	return body.replace(NOTE_LINK, (match, text: string, id: string, anchor: string | undefined) => {
		if (targets.resourceIds.has(id)) return match;
		const file = targets.chapterFile.get(id);
		if (file === undefined) return outsideLink(text, id, targets);
		return `[${text}](${file}#${targets.anchors.resolve(id, anchor ?? null)})`;
	});
}
