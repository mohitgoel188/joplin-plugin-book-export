import { type Chapter, diagramSourceBlock, fillDiagrams, prepareBook } from './chapters';
import { DOC_TYPES, type DocType, docTypeOf, TAG_PREFIX } from './diataxis';
import { READER_JS } from './html/app';
import { READER_CSS } from './html/theme';
import { buildLinkGraph } from './grouping';
import { escapeHtml } from './render';
import { readingMinutes } from './sections';
import { type BookSources, toBase64 } from './sources';
import type { Book } from './types';

/** `diataxis`: notes grouped by type with the hub as "Start here". `blog`: one dated list. */
export type HtmlLayout = 'diataxis' | 'blog';
export type LayoutChoice = HtmlLayout | 'auto';

/** `auto` picks Diátaxis when any note carries a `diataxis/*` tag, else the blog layout. */
export function resolveLayout(book: Book, choice: LayoutChoice): HtmlLayout {
	if (choice !== 'auto') return choice;
	return book.notes.some((n) => (n.tags ?? []).some((t) => t.toLowerCase().startsWith(TAG_PREFIX))) ? 'diataxis' : 'blog';
}

interface Group {
	readonly label: string;
	readonly need: string;
	readonly entries: readonly Entry[];
}

interface Entry {
	readonly chapter: Chapter;
	readonly type: DocType;
	/** Short name for navigation: the title minus the book title it repeats. */
	readonly navTitle: string;
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

/**
 * Reading order for the HTML reader.
 *
 * - `diataxis`: the hub (first note of a linked book) as "Start here", then the
 *   rest grouped by Diátaxis type, book order kept within a group.
 * - `blog`: one "Notes" list in book order (hub first for a linked book).
 */
export function readerOrder(book: Book, chapters: readonly Chapter[], layout: HtmlLayout = 'diataxis'): { start: Entry | null; groups: Group[] } {
	const entries = chapters.map((chapter): Entry => ({
		chapter,
		type: docTypeOf(chapter.note),
		navTitle: shortTitle(chapter.title, book.title),
	}));
	if (layout === 'blog') return { start: null, groups: [{ label: 'Notes', need: '', entries }] };
	const start = book.kind === 'linked' && entries.length > 1 ? entries[0] : null;
	const rest = start ? entries.slice(1) : entries;
	const groups = DOC_TYPES.map((t) => ({ label: t.label, need: t.need, entries: rest.filter((e) => e.type === t.type) })).filter(
		(g) => g.entries.length,
	);
	return { start, groups };
}

const typeLabel = (type: DocType) => DOC_TYPES.find((t) => t.type === type)?.label ?? '';

function chips(tags: readonly string[]): string {
	const shown = tags.filter((t) => !t.toLowerCase().startsWith(TAG_PREFIX)).sort();
	return shown
		.map((t) => {
			const [kind, value] = t.includes('/') ? [t.slice(0, t.indexOf('/')), t.slice(t.indexOf('/') + 1)] : ['', t];
			const cls = kind === 'status' ? ` status-${escapeHtml(value)}` : '';
			return `<span class="chip${cls}">${escapeHtml(kind === 'repo' || kind === 'status' ? value : t)}</span>`;
		})
		.join('');
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function sidebar(start: Entry | null, groups: readonly Group[], layout: HtmlLayout): string {
	const link = (e: Entry) => {
		const date = layout === 'blog' && e.chapter.note.updatedTime ? `<small>${isoDate(e.chapter.note.updatedTime)}</small>` : '';
		return `<li><a href="#${e.chapter.anchor}" data-note-link="note-${e.chapter.anchor}">${escapeHtml(e.navTitle)}${date}</a></li>`;
	};
	const startHtml = start
		? `<a class="start" href="#${start.chapter.anchor}" data-note-link="note-${start.chapter.anchor}"><small>Start here</small><span>${escapeHtml(start.navTitle === start.chapter.title ? 'Overview' : start.navTitle)}</span></a>`
		: '';
	const groupHtml = groups
		.map(
			(g) =>
				`<section class="group"><h2>${escapeHtml(g.label)}</h2>${g.need ? `<p>${escapeHtml(g.need)}</p>` : ''}<ul>${g.entries.map(link).join('')}</ul></section>`,
		)
		.join('');
	return `<nav class="sidebar" aria-label="Notes">${startHtml}${groupHtml}</nav>`;
}

function article(entry: Entry, backlinks: readonly Entry[], prev: Entry | undefined, next: Entry | undefined, body: string, eyebrow: string): string {
	const { chapter } = entry;
	const meta = [
		chapter.note.updatedTime ? `<span>Updated ${isoDate(chapter.note.updatedTime)}</span>` : '',
		`<span>${readingMinutes(chapter.note.body)} min read</span>`,
		`<span class="chips">${chips(chapter.note.tags ?? [])}</span>`,
	].join('');
	const back = backlinks.length
		? `<div class="backlinks"><h2>Linked from</h2><ul>${backlinks.map((b) => `<li><a href="#${b.chapter.anchor}">${escapeHtml(b.navTitle)}</a></li>`).join('')}</ul></div>`
		: '';
	const pager =
		prev || next
			? `<nav class="pager">${prev ? `<a class="prev" href="#${prev.chapter.anchor}"><small>← Previous</small>${escapeHtml(prev.navTitle)}</a>` : ''}${next ? `<a class="next" href="#${next.chapter.anchor}"><small>Next →</small>${escapeHtml(next.navTitle)}</a>` : ''}</nav>`
			: '';
	return `<article class="note" id="note-${chapter.anchor}" data-title="${escapeHtml(entry.navTitle)}">
<header class="hero">${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ''}
<h1 id="${chapter.anchor}">${escapeHtml(chapter.title)}</h1><div class="meta">${meta}</div></header>
<div class="prose">${body}</div>
<footer class="note-foot">${back}${pager}</footer>
</article>`;
}

/**
 * One self-contained HTML reader for `book`: notes grouped by Diátaxis type in
 * the sidebar, one note shown at a time, "On this page", backlinks, search,
 * images as data URIs and diagrams as inline SVG. Each note's own "Contents"
 * section is dropped; the reader builds that panel itself.
 */
export async function buildHtmlBook(book: Book, sources: BookSources, layoutChoice: LayoutChoice = 'auto'): Promise<string> {
	const layout = resolveLayout(book, layoutChoice);
	const prepared = await prepareBook(book, sources, {
		chapterFile: () => '',
		outside: 'joplinUrl',
		xhtml: false,
		plainText: false,
		stripContents: true,
		imageSrc: (r) => `data:${r.mime};base64,${toBase64(r.data)}`,
	});
	const diagrams = prepared.mermaid.length ? await sources.renderMermaid(prepared.mermaid, 'svg') : [];
	const place = (i: number) => {
		const d = diagrams[i];
		return d && 'svg' in d ? d.svg : diagramSourceBlock(prepared.mermaid[i], escapeHtml);
	};

	const { start, groups } = readerOrder(book, prepared.chapters, layout);
	const ordered = [...(start ? [start] : []), ...groups.flatMap((g) => g.entries)];
	const byId = new Map(ordered.map((e) => [e.chapter.note.id, e]));
	const graph = buildLinkGraph(book.notes);
	const backlinksOf = (id: string) => ordered.filter((e) => e.chapter.note.id !== id && (graph.get(e.chapter.note.id) ?? []).includes(id));

	const articles = ordered.map((e, i) =>
		article(e, backlinksOf(e.chapter.note.id), ordered[i - 1], ordered[i + 1], fillDiagrams(e.chapter.html, place), e === start ? 'Start here' : layout === 'diataxis' ? typeLabel(e.type) : ''),
	);
	const title = escapeHtml(book.title);
	const first = byId.get(ordered[0]?.chapter.note.id ?? '');
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Joplin Book Export"><title>${title}</title><style>${READER_CSS}</style></head>
<body data-book="${title}" data-layout="${layout}">
<header class="topbar">
<button class="icon-btn nav-toggle" aria-label="Show notes">☰</button>
<a class="brand" href="#${first?.chapter.anchor ?? ''}">${title}</a>
<div class="search" role="search"><input type="search" placeholder="Search notes  ( / )" aria-label="Search notes"><div class="results"></div></div>
<button class="icon-btn theme-toggle" aria-label="Switch light or dark">◐</button>
</header>
<div class="shell">
${sidebar(start, groups, layout)}
<main>
${articles.join('\n')}
</main>
<aside class="onpage" aria-label="On this page"><h2>On this page</h2><ol></ol></aside>
</div>
<div class="zoom" role="dialog" aria-label="Diagram"><div class="zoom-bar"><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="close" aria-label="Close">✕</button></div><div class="zoom-stage"><div></div></div></div>
<script>${READER_JS}</script>
</body></html>
`;
}
