import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { noteAnchor } from '../src/core/anchors';
import { bookIdFor, buildEpubBook } from '../src/core/epubBook';
import type { BookSources, Resource } from '../src/core/sources';
import type { Book } from '../src/core/types';
import { toXhtml } from '../src/core/xhtml';
import { link, nid, note } from './fixtures';

const png: Resource = { id: nid('img'), mime: 'image/png', extension: 'PNG', data: new Uint8Array([9, 9]) };

const sources = (diagram: 'png' | 'fail' = 'png'): BookSources => ({
	loadResource: async (id) => (id === png.id ? png : null),
	noteTitle: async (id) => (id === nid('outside') ? 'Outside note' : undefined),
	renderMermaid: async (src) =>
		src.map(() => (diagram === 'png' ? { png: new Uint8Array([1, 2, 3]), width: 10, height: 10 } : null)),
});

const hub = note('hub', `## Part {#p-one}\n\n🚨 ${link('leaf', 'l-two', 'to leaf')} ${link('outside', undefined, 'away')}\n\n![i](:/${png.id})`);
const leaf = note('leaf', `## Two {#l-two}\n\n<table><tr><td>a<br>b&nbsp;c</td></tr></table>\n\n\`\`\`mermaid\ngraph TD\nA-->B\n\`\`\``);
const book: Book = { title: '🏍️ Hub book', kind: 'linked', notes: [hub, leaf] };

async function unzip(diagram: 'png' | 'fail' = 'png') {
	const bytes = await buildEpubBook(book, sources(diagram), { bookId: bookIdFor(book), modified: new Date('2026-10-30T10:00:00Z') });
	return JSZip.loadAsync(bytes);
}

describe('buildEpubBook', () => {
	it('stores mimetype first and uncompressed', async () => {
		const bytes = await buildEpubBook(book, sources(), { bookId: bookIdFor(book) });
		const header = new DataView(bytes.buffer, bytes.byteOffset);
		expect(header.getUint16(8, true)).toBe(0); // compression method 0 = stored
		expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe('mimetype');
		expect(new TextDecoder().decode(bytes.subarray(38, 58))).toBe('application/epub+zip');
	});

	it('writes one chapter per note with cross-chapter links and text in place of emoji', async () => {
		const zip = await unzip();
		const ch1 = await zip.file('OEBPS/ch01.xhtml')!.async('string');
		expect(ch1).toContain('href="ch02.xhtml#l-two"');
		expect(ch1).toContain('[!!]');
		expect(ch1).toContain('away (Joplin: Outside note)');
		expect(ch1).toContain('src="images/' + png.id + '.png"');
		expect(ch1).toContain(`id="${noteAnchor(hub.id)}"`);
	});

	it('makes raw HTML well-formed and packs diagrams as PNG', async () => {
		const zip = await unzip();
		const ch2 = await zip.file('OEBPS/ch02.xhtml')!.async('string');
		expect(ch2).toContain('a<br/>b&#xa0;c');
		expect(ch2).toContain('<img src="images/diagram-1.png" alt="Diagram 1"/>');
		expect(zip.file('OEBPS/images/diagram-1.png')).not.toBeNull();
		expect(zip.file(`OEBPS/images/${png.id}.png`)).not.toBeNull();
	});

	it('lists every file in the manifest and builds nested contents', async () => {
		const zip = await unzip();
		const opf = await zip.file('OEBPS/content.opf')!.async('string');
		for (const href of ['ch01.xhtml', 'ch02.xhtml', 'nav.xhtml', 'toc.ncx', 'style.css', 'images/diagram-1.png', `images/${png.id}.png`]) {
			expect(opf).toContain(`href="${href}"`);
		}
		expect(opf).toContain('<dc:title>Hub book</dc:title>');
		const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');
		expect(nav).toContain(`<a href="ch01.xhtml#${noteAnchor(hub.id)}">hub</a><ol><li><a href="ch01.xhtml#p-one">Part</a></li></ol>`);
		const ncx = await zip.file('OEBPS/toc.ncx')!.async('string');
		expect(ncx).toContain('<content src="ch02.xhtml#l-two"/>');
	});

	it('falls back to diagram source when rendering fails', async () => {
		const zip = await unzip('fail');
		const ch2 = await zip.file('OEBPS/ch02.xhtml')!.async('string');
		expect(ch2).toContain('class="diagram-source"');
		expect(zip.file('OEBPS/images/diagram-1.png')).toBeNull();
	});
});

describe('toXhtml / bookIdFor', () => {
	it('closes void tags and unclosed paragraphs', () => {
		expect(toXhtml('<p>a<br>b<p>c')).toBe('<p>a<br/>b</p><p>c</p>');
	});

	it('derives a uuid-shaped id from the hub note', () => {
		expect(bookIdFor(book)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});
});
