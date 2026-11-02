/**
 * Text replacements for e-ink readers. KOReader's bundled fonts have no emoji
 * glyphs and draw empty boxes, so common markers become text labels and the
 * rest are dropped. Ported from the /pr-review `review_to_epub.py` script.
 */
const EMOJI_LABELS: ReadonlyArray<readonly [string, string]> = [
	['🚨', '[!!]'],
	['⚠️', '[!]'],
	['⚠', '[!]'],
	['✅', '[OK]'],
	['❌', '[X]'],
	['➕', '[+]'],
	['←', '<-'],
	['→', '->'],
];

/** Pictographic emoji plus the joiners and variation selectors that build composite ones. */
const OTHER_EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu;

export function emojiToText(text: string): string {
	const labelled = EMOJI_LABELS.reduce((acc, [emoji, label]) => acc.split(emoji).join(label), text);
	return labelled.replace(OTHER_EMOJI, '');
}

/** A title without emoji and with collapsed whitespace, safe for an e-reader's library list. */
export function plainTitle(title: string): string {
	return emojiToText(title).replace(/\s+/g, ' ').trim();
}
