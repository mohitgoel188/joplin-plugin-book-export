import { describe, expect, it } from 'vitest';
import { noteAnchor } from '../src/core/anchors';
import { buildHtmlBook } from '../src/core/htmlBook';
import { mermaidSlot, renderNote } from '../src/core/render';
import type { BookSources, Resource } from '../src/core/sources';
import type { Book } from '../src/core/types';
import { link, nid, note } from './fixtures';

const opts = { chapterAnchor: 'n-x', xhtml: false, resourceSrc: () => null };

describe('renderNote', () => {
	it('keeps {#id} anchors and collects ## / ### headings for the contents', () => {
		const r = renderNote('## Current state {#h-state}\n\n### Sub *one*\n\n#### Deep', opts);
		expect(r.html).toContain('<h2 id="h-state">Current state</h2>');
		expect(r.headings).toEqual([
			{ level: 2, id: 'h-state', text: 'Current state' },
			{ level: 3, id: 'n-x-h2', text: 'Sub one' },
		]);
	});

	it('replaces mermaid fences with slots and keeps other fences', () => {
		const r = renderNote('```mermaid\ngraph LR\nA-->B\n```\n\n```sql\nselect 1;\n```', opts);
		expect(r.mermaid).toEqual(['graph LR\nA-->B\n']);
		expect(r.html).toContain(mermaidSlot(0));
		expect(r.html).toContain('select 1;');
	});

	it('resolves attachment images and strips attachment link targets', () => {
		const r = renderNote(`![pic](:/${nid('img')}) [file](:/${nid('doc')}) ![gone](:/${nid('x')})`, {
			...opts,
			resourceSrc: (id) => (id === nid('img') ? 'images/a.png' : null),
		});
		expect(r.html).toContain('src="images/a.png"');
		expect(r.html).toContain('<a>file</a>');
		expect(r.html).toContain('gone');
		expect(r.html).not.toContain(':/');
	});

	it('emits XHTML void tags when asked', () => {
		expect(renderNote('a  \nb', { ...opts, xhtml: true }).html).toContain('<br />');
	});

	it('drops attributes other than id and class', () => {
		expect(renderNote('para {onclick=alert(1)}', opts).html).not.toContain('onclick');
	});
});

const png: Resource = { id: nid('img'), mime: 'image/png', extension: 'png', data: new Uint8Array([1, 2, 3]) };

const sources = (svg: string | null = '<svg>d</svg>'): BookSources => ({
	loadResource: async (id) => (id === png.id ? png : null),
	noteTitle: async (id) => (id === nid('outside') ? 'Outside note' : undefined),
	renderMermaid: async (src) => src.map(() => (svg === null ? null : { svg })),
});

describe('buildHtmlBook', () => {
	const hub = note('hub', `# x\n\n## Part {#p-one}\n\n${link('leaf', 'l-two', 'to leaf')} ${link('outside', undefined, 'away')} ![i](:/${png.id})`);
	const leaf = note('leaf', `## Two {#l-two}\n\n${link('hub', undefined, 'back')}\n\n\`\`\`mermaid\ngraph TD\nA-->B\n\`\`\``);
	const book: Book = { title: 'Hub <book>', kind: 'linked', notes: [hub, leaf] };

	it('builds one page with same-page links, data-URI images and inline SVG', async () => {
		const html = await buildHtmlBook(book, sources());
		expect(html).toContain('<title>Hub &lt;book&gt;</title>');
		expect(html).toContain('href="#l-two"');
		expect(html).toContain(`href="#${noteAnchor(hub.id)}"`);
		expect(html).toContain(`href="joplin://x-callback-url/openNote?id=${nid('outside')}"`);
		expect(html).toContain('src="data:image/png;base64,AQID"');
		expect(html).toContain('<svg>d</svg>');
		expect(html).toContain('<script>');
	});

	it('pins the hub as Start here and adds backlinks and a pager', async () => {
		const html = await buildHtmlBook(book, sources(), 'diataxis');
		expect(html).toContain(`<a class="start" href="#${noteAnchor(hub.id)}"`);
		expect(html).toContain('<div class="eyebrow">Start here</div>');
		expect(html).toMatch(/<h2>Linked from<\/h2><ul><li><a href="#n-[0-9a-f]+">leaf<\/a>/);
		expect(html).toContain('<small>Next →</small>leaf');
	});

	it('uses the blog layout for untagged notes by default', async () => {
		const html = await buildHtmlBook(book, sources());
		expect(html).toContain('data-layout="blog"');
		expect(html).not.toContain('class="start"');
		expect(html).toContain('<h2>Notes</h2>');
	});

	it('falls back to the diagram source when rendering fails', async () => {
		const html = await buildHtmlBook(book, sources(null));
		expect(html).toContain('<pre class="diagram-source"><code>graph TD\nA--&gt;B\n</code></pre>');
	});
});
