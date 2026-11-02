import JSZip from 'jszip';
import { type Chapter, diagramSourceBlock, fillDiagrams, prepareBook } from './chapters';
import { plainTitle } from './emoji';
import { escapeHtml } from './render';
import type { BookSources, RenderedDiagram, Resource } from './sources';
import type { Book } from './types';
import { toXhtml } from './xhtml';

/** KOReader-oriented stylesheet: serif body, sans headings, nothing that fights the reader's own font settings. */
const CSS = `
body { font-family: serif; line-height: 1.4; margin: 0 0.4em; }
h1, h2, h3, h4 { font-family: sans-serif; page-break-after: avoid; }
h1.chapter-title { font-size: 1.5em; margin-top: 0; }
h2 { border-bottom: 1px solid #000; padding-bottom: 0.1em; }
code { font-family: monospace; font-size: 0.85em; word-break: break-all; }
pre { white-space: pre-wrap; word-break: break-all; font-size: 0.8em; border-left: 2px solid #000; padding-left: 0.4em; }
table { border-collapse: collapse; font-size: 0.85em; }
th, td { border: 1px solid #000; padding: 0.15em 0.3em; vertical-align: top; }
li { margin-bottom: 0.3em; }
blockquote { margin: 0.5em 0; padding-left: 0.6em; border-left: 2px solid #000; }
img { max-width: 100%; }
figure.diagram { margin: 0.8em 0; text-align: center; page-break-inside: avoid; }
figure.diagram img { max-width: 100%; height: auto; }
nav ol { list-style: none; padding-left: 1em; }
`;

const CONTAINER_XML = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`;

const IMAGE_TYPES: Readonly<Record<string, string>> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	webp: 'image/webp',
};

export const chapterFile = (index: number) => `ch${String(index + 1).padStart(2, '0')}.xhtml`;
const resourceFile = (r: Resource) => `images/${r.id}.${r.extension.toLowerCase()}`;
const diagramFile = (index: number) => `images/diagram-${index + 1}.png`;

function xhtmlPage(title: string, body: string): string {
	return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body></html>
`;
}

function navPage(title: string, chapters: readonly Chapter[]): string {
	const items = chapters.map((c, i) => {
		const file = chapterFile(i);
		const sub = c.headings
			.filter((h) => h.level === 2)
			.map((h) => `<li><a href="${file}#${h.id}">${escapeHtml(h.text)}</a></li>`)
			.join('');
		return `<li><a href="${file}#${c.anchor}">${escapeHtml(c.title)}</a>${sub ? `<ol>${sub}</ol>` : ''}</li>`;
	});
	return xhtmlPage(title, `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${items.join('')}</ol></nav>`);
}

/** EPUB 2 table of contents; Kindle conversions and older readers still look for it. */
function ncx(title: string, bookId: string, chapters: readonly Chapter[]): string {
	let order = 0;
	const point = (label: string, src: string, children = '') =>
		`<navPoint id="np${++order}" playOrder="${order}"><navLabel><text>${escapeHtml(label)}</text></navLabel><content src="${src}"/>${children}</navPoint>`;
	const points = chapters.map((c, i) => {
		const file = chapterFile(i);
		const head = point(c.title, `${file}#${c.anchor}`);
		const subs = c.headings.filter((h) => h.level === 2).map((h) => point(h.text, `${file}#${h.id}`));
		return head.replace('</navPoint>', `${subs.join('')}</navPoint>`);
	});
	return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="urn:uuid:${bookId}"/></head>
<docTitle><text>${escapeHtml(title)}</text></docTitle>
<navMap>${points.join('')}</navMap>
</ncx>
`;
}

interface ManifestItem {
	readonly id: string;
	readonly href: string;
	readonly type: string;
	readonly properties?: string;
}

function opf(title: string, bookId: string, modified: string, items: readonly ManifestItem[], spine: readonly string[]): string {
	const manifest = items
		.map((i) => `<item id="${i.id}" href="${i.href}" media-type="${i.type}"${i.properties ? ` properties="${i.properties}"` : ''}/>`)
		.join('\n    ');
	return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${bookId}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:creator>Joplin</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${manifest}
  </manifest>
  <spine toc="ncx">${spine.map((id) => `<itemref idref="${id}"/>`).join('')}</spine>
</package>
`;
}

/** A stable book id from the first (hub) note's id, so a re-export replaces the same book on the reader. */
export function bookIdFor(book: Book): string {
	const hex = (book.notes[0]?.id ?? '').padEnd(32, '0').slice(0, 32);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface EpubOptions {
	/** Stable id for the book; reuse it so readers treat a re-export as the same book. */
	readonly bookId: string;
	readonly modified?: Date;
}

/**
 * An EPUB 3 book for `book`: one chapter per note, nested contents (nav + ncx),
 * attachments packed in, diagrams as PNG and emoji replaced with text.
 */
export async function buildEpubBook(book: Book, sources: BookSources, options: EpubOptions): Promise<Uint8Array> {
	const prepared = await prepareBook(book, sources, {
		chapterFile,
		outside: 'plainText',
		xhtml: true,
		plainText: true,
		imageSrc: (r) => (IMAGE_TYPES[r.extension.toLowerCase()] ? resourceFile(r) : null),
	});
	const diagrams: RenderedDiagram[] = prepared.mermaid.length ? await sources.renderMermaid(prepared.mermaid, 'png') : [];
	const place = (i: number) => {
		const d = diagrams[i];
		return d && 'png' in d ? `<img src="${diagramFile(i)}" alt="Diagram ${i + 1}"/>` : diagramSourceBlock(prepared.mermaid[i], escapeHtml);
	};

	const title = plainTitle(book.title);
	const zip = new JSZip();
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
	zip.file('META-INF/container.xml', CONTAINER_XML);

	const items: ManifestItem[] = [
		{ id: 'nav', href: 'nav.xhtml', type: 'application/xhtml+xml', properties: 'nav' },
		{ id: 'ncx', href: 'toc.ncx', type: 'application/x-dtbncx+xml' },
		{ id: 'css', href: 'style.css', type: 'text/css' },
	];
	const spine: string[] = [];
	prepared.chapters.forEach((c, i) => {
		const body = `<h1 class="chapter-title" id="${c.anchor}">${escapeHtml(c.title)}</h1>\n${toXhtml(fillDiagrams(c.html, place))}`;
		zip.file(`OEBPS/${chapterFile(i)}`, xhtmlPage(c.title, body));
		items.push({ id: `ch${i + 1}`, href: chapterFile(i), type: 'application/xhtml+xml' });
		spine.push(`ch${i + 1}`);
	});
	for (const resource of prepared.resources.values()) {
		const type = IMAGE_TYPES[resource.extension.toLowerCase()];
		if (!type) continue;
		zip.file(`OEBPS/${resourceFile(resource)}`, resource.data);
		items.push({ id: `res-${resource.id}`, href: resourceFile(resource), type });
	}
	diagrams.forEach((d, i) => {
		if (!d || !('png' in d)) return;
		zip.file(`OEBPS/${diagramFile(i)}`, d.png);
		items.push({ id: `diagram-${i + 1}`, href: diagramFile(i), type: 'image/png' });
	});

	const modified = (options.modified ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
	zip.file('OEBPS/nav.xhtml', navPage(title, prepared.chapters));
	zip.file('OEBPS/toc.ncx', ncx(title, options.bookId, prepared.chapters));
	zip.file('OEBPS/style.css', CSS);
	zip.file('OEBPS/content.opf', opf(title, options.bookId, modified, items, spine));
	return zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
