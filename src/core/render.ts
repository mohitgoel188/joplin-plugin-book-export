import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import taskLists from 'markdown-it-task-lists';
import { headingElementId, headingText, uniqueSlugs } from './slugs';

/** A heading that goes into the book's table of contents. */
export interface Heading {
	readonly level: number;
	readonly id: string;
	readonly text: string;
}

export interface RenderOptions {
	/** Prefix for ids given to headings that have no `{#id}` of their own. */
	readonly chapterAnchor: string;
	/** `src` for an attachment shown as an image; null leaves the alt text only. */
	readonly resourceSrc: (resourceId: string) => string | null;
	/** Emit XHTML (self-closed void tags), as EPUB requires. */
	readonly xhtml: boolean;
}

/** A run of the note that starts at a top-level `##` or `###` heading (or at the top, with no heading). */
export interface Block {
	readonly heading: Heading | null;
	readonly headingHtml: string;
	readonly bodyHtml: string;
}

export interface RenderedNote {
	readonly html: string;
	readonly headings: readonly Heading[];
	/** The same html split at top-level `##` / `###` headings; joined, they equal `html`. */
	readonly blocks: readonly Block[];
	/** Mermaid sources in order; the html holds a `mermaidSlot(i)` marker for each. */
	readonly mermaid: readonly string[];
}

/** Placeholder left in the html where diagram `index` goes once it is rendered. */
export const mermaidSlot = (index: number) => `<!--mermaid-slot:${index}-->`;
export const MERMAID_SLOT = /<!--mermaid-slot:(\d+)-->/g;

type Md = InstanceType<typeof MarkdownIt>;

const RESOURCE = /^:\/([0-9a-f]{32})$/;
const TOC_LEVELS = new Set([2, 3]);

function createParser(xhtml: boolean): Md {
	return new MarkdownIt({ html: true, linkify: true, xhtmlOut: xhtml, breaks: false })
		.use(attrs, { allowedAttributes: ['id', 'class'] })
		.use(mark)
		.use(footnote)
		.use(taskLists, { enabled: false });
}

function installRules(md: Md, options: RenderOptions, mermaid: string[]): void {
	const fence = md.renderer.rules.fence;
	md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
		const token = tokens[idx];
		if (token.info.trim().toLowerCase() !== 'mermaid') return fence ? fence(tokens, idx, opts, env, self) : '';
		mermaid.push(token.content);
		return `<figure class="diagram">${mermaidSlot(mermaid.length - 1)}</figure>\n`;
	};

	const image = md.renderer.rules.image;
	md.renderer.rules.image = (tokens, idx, opts, env, self) => {
		const token = tokens[idx];
		const match = RESOURCE.exec(String(token.attrGet('src') ?? ''));
		if (match) {
			const src = options.resourceSrc(match[1]);
			if (src === null) return md.utils.escapeHtml(token.content);
			token.attrSet('src', src);
		}
		return image ? image(tokens, idx, opts, env, self) : self.renderToken(tokens, idx, opts);
	};

	md.renderer.rules.link_open = (tokens, idx, opts, _env, self) => {
		const token = tokens[idx];
		// An attachment link (`[file](:/res)`) has no meaning outside Joplin: keep the text only.
		if (RESOURCE.test(String(token.attrGet('href') ?? ''))) token.attrs = (token.attrs ?? []).filter(([name]) => name !== 'href');
		return self.renderToken(tokens, idx, opts);
	};
}

type Tokens = ReturnType<Md['parse']>;

/**
 * Give every heading an id and collect the TOC-level ones. A heading without a
 * `{#id}` gets Joplin's slug for it (see `slugs.ts`), the same id `AnchorPlan`
 * resolves links to. Runs on the token stream before rendering.
 */
function collectHeadings(tokens: Tokens, chapterAnchor: string): Heading[] {
	const opens = tokens.flatMap((token, i) => (token.type === 'heading_open' ? [{ token, text: headingText(tokens[i + 1]?.content ?? '') }] : []));
	const slugged = opens.filter(({ token }) => token.attrGet('id') === null);
	const slugList = uniqueSlugs(slugged.map((s) => s.text));
	const slugs = new Map(slugged.map((h, i) => [h.token, slugList[i]]));
	const headings: Heading[] = [];
	for (const { token, text } of opens) {
		const own = token.attrGet('id');
		const id = own === null ? headingElementId(chapterAnchor, slugs.get(token) ?? '') : String(own);
		token.attrSet('id', id);
		const level = Number(token.tag.slice(1));
		if (TOC_LEVELS.has(level)) headings.push({ level, id, text });
	}
	return headings;
}

/** Split the rendered note at top-level `##` / `###` headings. */
function splitBlocks(md: Md, tokens: Tokens, headings: readonly Heading[], env: Parameters<Md['renderer']['render']>[2]): Block[] {
	const byId = new Map(headings.map((h) => [h.id, h]));
	const starts = tokens.flatMap((t, i) => (t.type === 'heading_open' && t.level === 0 && TOC_LEVELS.has(Number(t.tag.slice(1))) ? [i] : []));
	const render = (from: number, to: number) => md.renderer.render(tokens.slice(from, to), md.options, env);
	const blocks: Block[] = [];
	if (!starts.length || starts[0] > 0) blocks.push({ heading: null, headingHtml: '', bodyHtml: render(0, starts[0] ?? tokens.length) });
	starts.forEach((start, n) => {
		const end = start + 3; // heading_open, inline, heading_close
		blocks.push({
			heading: byId.get(String(tokens[start].attrGet('id'))) ?? null,
			headingHtml: render(start, end),
			bodyHtml: render(end, starts[n + 1] ?? tokens.length),
		});
	});
	return blocks;
}

/** Render one note's (already link-rewritten) markdown to HTML. */
export function renderNote(markdown: string, options: RenderOptions): RenderedNote {
	const mermaid: string[] = [];
	const md = createParser(options.xhtml);
	installRules(md, options, mermaid);
	const env = {};
	const tokens = md.parse(markdown, env);
	const headings = collectHeadings(tokens, options.chapterAnchor);
	const blocks = splitBlocks(md, tokens, headings, env);
	const html = blocks.map((b) => b.headingHtml + b.bodyHtml).join('');
	return { html, headings, blocks, mermaid };
}

export const escapeHtml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
