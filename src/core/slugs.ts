/**
 * Heading anchors the way Joplin makes them, so a note's own `[x](#some-heading)`
 * and `[x](:/id#some-heading)` links keep working in the export.
 *
 * Joplin slugs heading text with `uslug`: keep letters, numbers, marks, spaces
 * and `-_~`; trim; turn every run of spaces and dashes into one dash; lowercase.
 * A repeated slug in one note gets `-1`, `-2`, … like markdown-it-anchor.
 */

const KEEP = /[\p{L}\p{N}\p{M}\p{Z}\s_~-]/u;
const FENCE = /^\s*(```|~~~)/;
const ATX_HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
/** A Note Link System id: these headings keep their own id and get no slug. */
const EXPLICIT_ID = /\{#[A-Za-z][\w:.-]*\}/;

export function headingSlug(text: string): string {
	const kept = Array.from(text).filter((c) => KEEP.test(c)).join('');
	return kept.trim().replace(/[\s-]+/g, '-').toLowerCase();
}

/** Heading text as it renders: inline markup, links and a trailing `{…}` attribute removed. */
export function headingText(raw: string): string {
	return raw
		.replace(/\s*\{[^}]*\}\s*$/, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/[`*]|~~/g, '');
}

/** Slugs for headings in document order, de-duplicated the way Joplin does. */
export function uniqueSlugs(texts: readonly string[]): string[] {
	const seen = new Map<string, number>();
	return texts.map((text) => {
		const slug = headingSlug(text);
		const count = seen.get(slug) ?? 0;
		seen.set(slug, count + 1);
		return count ? `${slug}-${count}` : slug;
	});
}

/**
 * Element id for a slugged heading. Prefixed with the note's anchor so two notes on
 * one HTML page cannot clash, and limited to characters valid in an XML id (EPUB).
 */
export const headingElementId = (noteAnchor: string, slug: string) =>
	`${noteAnchor}-${slug.replace(/[^\p{L}\p{N}_.-]/gu, '-') || 'section'}`;

/** Raw text of every ATX heading without an explicit `{#id}`, skipping code fences. */
export function sluggedHeadingTexts(body: string): string[] {
	const texts: string[] = [];
	let inFence = false;
	for (const line of body.split('\n')) {
		if (FENCE.test(line)) inFence = !inFence;
		if (inFence) continue;
		const match = ATX_HEADING.exec(line);
		if (match && !EXPLICIT_ID.test(match[2])) texts.push(headingText(match[2]));
	}
	return texts;
}
