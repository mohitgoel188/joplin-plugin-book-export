import type { Chapter } from './chapters';
import { type DocType, docTypeOf, hasDiataxisSections, sectionTypeOf } from './diataxis';
import type { Block } from './render';

/** One page of the HTML reader: a whole note, or one section of a note written in Diátaxis parts. */
export interface Page {
	/** Id of the page's `<h1>`; links to the note or the section land here. */
	readonly anchor: string;
	readonly title: string;
	/** Short name for navigation: the title minus the book title it repeats. */
	readonly navTitle: string;
	readonly type: DocType;
	/** The note the page comes from. */
	readonly chapter: Chapter;
	readonly html: string;
	/** The note's first page: it carries the note's backlinks. */
	readonly isNoteStart: boolean;
}

/** The part of `title` after a shared prefix with the book title, or the whole title. */
export function shortTitle(title: string, bookTitle: string): string {
	const strip = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '').trim();
	const t = strip(title);
	const b = strip(bookTitle);
	if (!b || t === b || !t.toLowerCase().startsWith(b.toLowerCase())) return title;
	const rest = t.slice(b.length).replace(/^[\s:—–-]+/, '');
	return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : title;
}

/** True when the reader should show this note as one page per Diátaxis section. */
export const isSectioned = (chapter: Chapter) => Boolean(chapter.blocks?.length) && hasDiataxisSections(chapter.note.body);

interface Section {
	readonly head: Block | null;
	readonly children: readonly Block[];
}

/** Blocks grouped under their `##` heading; blocks before the first `##` have no head. */
function sectionsOf(blocks: readonly Block[]): Section[] {
	const sections: { head: Block | null; children: Block[] }[] = [{ head: null, children: [] }];
	for (const block of blocks) {
		if (block.heading?.level === 2) sections.push({ head: block, children: [] });
		else sections[sections.length - 1].children.push(block);
	}
	return sections;
}

const full = (blocks: readonly Block[]) => blocks.map((b) => b.headingHtml + b.bodyHtml).join('');
/** Keeps a removed heading's id on the page, so links to it still open the right page. */
const anchorMark = (id: string) => `<span id="${id}" class="section-anchor"></span>`;

/**
 * Pages for one note. A note whose `##` headings name Diátaxis parts (Tutorial,
 * How-to guides, Reference, Explanation) is split: the text before them is the
 * note's overview, each `###` inside a part becomes a page of that type (a part
 * without `###` is one page), and a later untyped `##` becomes an "other" page.
 * Any other note is one page.
 */
export function pagesOf(chapter: Chapter, bookTitle: string, split: boolean): Page[] {
	const base = { chapter, isNoteStart: false } as const;
	const overview = (html: string, type: DocType): Page => ({
		...base,
		anchor: chapter.anchor,
		title: chapter.title,
		navTitle: shortTitle(chapter.title, bookTitle),
		type,
		html,
		isNoteStart: true,
	});
	if (!split || !isSectioned(chapter)) return [overview(chapter.html, docTypeOf(chapter.note))];

	const sections = sectionsOf(chapter.blocks ?? []);
	const firstTyped = sections.findIndex((s) => s.head?.heading && sectionTypeOf(s.head.heading.text));
	if (firstTyped < 0) return [overview(chapter.html, docTypeOf(chapter.note))];
	const intro = sections.slice(0, firstTyped).map((s) => (s.head ? full([s.head]) : '') + full(s.children));
	const pages: Page[] = [overview(intro.join(''), 'other')];

	for (const { head, children } of sections.slice(firstTyped)) {
		const heading = head?.heading;
		if (!head || !heading) continue;
		const type = sectionTypeOf(heading.text);
		const subs = type ? children.filter((b) => b.heading?.level === 3) : [];
		if (!subs.length) {
			pages.push({ ...base, anchor: heading.id, title: heading.text, navTitle: heading.text, type: type ?? 'other', html: head.bodyHtml + full(children) });
			continue;
		}
		// Text between the `##` and its first `###` opens the first page, with the `##` id kept.
		const lead = anchorMark(heading.id) + head.bodyHtml + full(children.slice(0, children.indexOf(subs[0])));
		subs.forEach((sub, i) => {
			const own = sub.heading;
			if (!own) return;
			pages.push({ ...base, anchor: own.id, title: own.text, navTitle: own.text, type: type ?? 'other', html: (i === 0 ? lead : '') + sub.bodyHtml });
		});
	}
	return pages;
}
