import { AnchorPlan, noteAnchor } from './anchors';
import { emojiToText } from './emoji';
import { extractLinks } from './links';
import { type Heading, MERMAID_SLOT, mermaidSlot, renderNote } from './render';
import { type LinkTargets, rewriteNoteLinks } from './rewriteLinks';
import { stripContentsSection } from './sections';
import type { BookSources, RenderedDiagram, Resource } from './sources';
import type { Book, NoteRecord } from './types';

export interface Chapter {
	readonly note: NoteRecord;
	readonly title: string;
	/** Id of the chapter's own heading; links that name only the note land here. */
	readonly anchor: string;
	readonly html: string;
	readonly headings: readonly Heading[];
}

export interface PreparedBook {
	readonly chapters: readonly Chapter[];
	/** Attachments referenced from the book, by id. */
	readonly resources: ReadonlyMap<string, Resource>;
	/** Every diagram in the book; chapter html holds `mermaidSlot(i)` markers into this list. */
	readonly mermaid: readonly string[];
}

export interface ChapterFormat {
	/** File that holds chapter `index` ('' when all chapters share one page). */
	readonly chapterFile: (index: number) => string;
	readonly outside: LinkTargets['outside'];
	readonly xhtml: boolean;
	/** Replace emoji with text labels (e-ink readers have no emoji glyphs). */
	readonly plainText: boolean;
	/** `src` to use for an image attachment; null shows its alt text instead. */
	readonly imageSrc: (resource: Resource) => string | null;
	/** Drop each note's hand-written "Contents" section (the reader builds its own). */
	readonly stripContents?: boolean;
}

async function resolveOutsideIds(book: Book, sources: BookSources) {
	const inBook = new Set(book.notes.map((n) => n.id));
	const ids = new Set(book.notes.flatMap((n) => extractLinks(n.body).map((l) => l.targetId)).filter((id) => !inBook.has(id)));
	const resources = new Map<string, Resource>();
	const titles = new Map<string, string>();
	for (const id of ids) {
		const resource = await sources.loadResource(id);
		if (resource) {
			resources.set(id, resource);
			continue;
		}
		const title = await sources.noteTitle(id);
		if (title !== undefined) titles.set(id, title);
	}
	return { resources, titles };
}

/** Link-rewrite and render every note of `book` for one output format. */
export async function prepareBook(input: Book, sources: BookSources, format: ChapterFormat): Promise<PreparedBook> {
	// Strip before planning anchors, so links to a removed "Contents" anchor fall back to the note itself.
	const book: Book = format.stripContents
		? { ...input, notes: input.notes.map((n) => ({ ...n, body: stripContentsSection(n.body) })) }
		: input;
	const { resources, titles } = await resolveOutsideIds(book, sources);
	const anchors = new AnchorPlan(book.notes);
	const targets: LinkTargets = {
		chapterFile: new Map(book.notes.map((n, i) => [n.id, format.chapterFile(i)])),
		anchors,
		resourceIds: new Set(resources.keys()),
		outsideTitle: (id) => titles.get(id),
		outside: format.outside,
	};
	const text = (s: string) => (format.plainText ? emojiToText(s) : s);

	const mermaid: string[] = [];
	const chapters = book.notes.map((note): Chapter => {
		const anchor = noteAnchor(note.id);
		const rendered = renderNote(text(rewriteNoteLinks(anchors.applyTo(note), targets)), {
			chapterAnchor: anchor,
			xhtml: format.xhtml,
			resourceSrc: (id) => {
				const resource = resources.get(id);
				return resource && resource.mime.startsWith('image/') ? format.imageSrc(resource) : null;
			},
		});
		const offset = mermaid.length;
		mermaid.push(...rendered.mermaid);
		const html = rendered.html.replace(MERMAID_SLOT, (_m, i: string) => mermaidSlot(offset + Number(i)));
		return { note, title: text(note.title).trim(), anchor, html, headings: rendered.headings };
	});
	return { chapters, resources, mermaid };
}

/** Replace each diagram slot in `html` using `place`, which gets the slot's global index. */
export function fillDiagrams(html: string, place: (index: number) => string): string {
	return html.replace(MERMAID_SLOT, (_m, i: string) => place(Number(i)));
}

/** Fallback when a diagram could not be rendered: show its source as a code block. */
export const diagramSourceBlock = (source: string, escape: (s: string) => string) =>
	`<pre class="diagram-source"><code>${escape(source)}</code></pre>`;

export type { RenderedDiagram };
