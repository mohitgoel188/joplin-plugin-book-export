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
			{ level: 3, id: 'n-x-sub-one', text: 'Sub one' },
		]);
		expect(r.html).toContain('<h4 id="n-x-deep">Deep</h4>');
	});

	it("slugs headings the way Joplin does, numbering repeats", () => {
		const r = renderNote('## Why ds-v2 writes `user_platform_access`\n\n## App code → registry (`a/b.py`)\n\n## Notes\n\n## Notes', opts);
		expect(r.headings.map((h) => h.id)).toEqual([
			'n-x-why-ds-v2-writes-user_platform_access',
			'n-x-app-code-registry-abpy',
			'n-x-notes',
			'n-x-notes-1',
		]);
	});

	it('splits the html into blocks at top-level ## and ### headings', () => {
		const r = renderNote('Intro\n\n## A\n\nText a\n\n### A1\n\nText a1\n\n> ## Quoted', opts);
		expect(r.blocks.map((b) => b.heading?.text ?? null)).toEqual([null, 'A', 'A1']);
		expect(r.blocks.map((b) => b.headingHtml + b.bodyHtml).join('')).toBe(r.html);
		expect(r.blocks[2].bodyHtml).toContain('Quoted');
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

	it('points #slug links at Joplin heading slugs, within a note and across notes', async () => {
		const a = note('a', `See [steps](#how-to-guides) and [far](:/${nid('b')}#pending-schema-change).\n\n## How-to guides\n\nx`);
		const b = note('b', `${link('a', undefined, 'back')}\n\n## Pending schema change\n\ny`);
		const html = await buildHtmlBook({ title: 'A', kind: 'linked', notes: [a, b] }, sources(), 'blog');
		const ids = new Set(Array.from(html.matchAll(/id="([^"]+)"/g), (m) => m[1]));
		const hrefs = Array.from(html.matchAll(/href="#([^"'+ ]+)"/g), (m) => m[1]);
		expect(hrefs).toContain(`${noteAnchor(a.id)}-how-to-guides`);
		expect(hrefs).toContain(`${noteAnchor(b.id)}-pending-schema-change`);
		expect(hrefs.filter((h) => !ids.has(h))).toEqual([]);
	});

	it('pages a note written as Diátaxis sections, keeping section links working', async () => {
		const body = [
			'Which part: [Tutorial](#tutorial), [Reference](#reference).',
			'## Tutorial\n\nFollow along.\n\n### First run\n\nDo this.',
			'## How-to guides\n\n### Deploy\n\nSteps.\n\n### Roll back\n\nSteps back.',
			'## Reference\n\nTables.',
			'## Explanation\n\n### Why\n\nBecause.',
		].join('\n\n');
		const one = note('one', body);
		const html = await buildHtmlBook({ title: one.title, kind: 'single', notes: [one] }, sources());
		const base = noteAnchor(one.id);
		expect(html).toContain('data-layout="diataxis"');
		expect(html).toContain(`<a class="start" href="#${base}"`);
		for (const [group, page] of [['Tutorials', 'first-run'], ['How-to guides', 'deploy'], ['How-to guides', 'roll-back'], ['Reference', 'reference'], ['Explanation', 'why']]) {
			expect(html).toContain(`<article class="note" id="note-${base}-${page}"`);
			expect(html).toMatch(new RegExp(`<h2>${group}</h2>.*href="#${base}-${page}"`, 's'));
		}
		// The ## id survives on the first page of its part, so "#tutorial" still lands somewhere.
		expect(html).toMatch(new RegExp(`id="note-${base}-first-run"[^]*?<span id="${base}-tutorial" class="section-anchor"></span>[^]*?</article>`));
		const ids = new Set(Array.from(html.matchAll(/id="([^"]+)"/g), (m) => m[1]));
		const hrefs = Array.from(html.matchAll(/href="#([^"'+ ]+)"/g), (m) => m[1]);
		expect(hrefs.filter((h) => !ids.has(h))).toEqual([]);
	});

	it('keeps a sectioned note as one page in the blog layout', async () => {
		const one = note('one', '## Tutorial\n\nx\n\n## Reference\n\ny');
		const html = await buildHtmlBook({ title: one.title, kind: 'single', notes: [one] }, sources(), 'blog');
		expect(html.match(/<article class="note"/g)).toHaveLength(1);
	});

	it('falls back to the diagram source when rendering fails', async () => {
		const html = await buildHtmlBook(book, sources(null));
		expect(html).toContain('<pre class="diagram-source"><code>graph TD\nA--&gt;B\n</code></pre>');
	});
});
