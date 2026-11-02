import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import taskLists from 'markdown-it-task-lists';

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

export interface RenderedNote {
	readonly html: string;
	readonly headings: readonly Heading[];
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

/** Give every TOC-level heading an id and collect it. Runs on the token stream before rendering. */
function collectHeadings(tokens: ReturnType<Md['parse']>, chapterAnchor: string): Heading[] {
	const headings: Heading[] = [];
	tokens.forEach((token, i) => {
		if (token.type !== 'heading_open') return;
		const level = Number(token.tag.slice(1));
		if (!TOC_LEVELS.has(level)) return;
		const id = String(token.attrGet('id') ?? `${chapterAnchor}-h${headings.length + 1}`);
		token.attrSet('id', id);
		const text = (tokens[i + 1]?.content ?? '').replace(/\s*\{[^}]*\}\s*$/, '').replace(/[*_`]/g, '');
		headings.push({ level, id, text });
	});
	return headings;
}

/** Render one note's (already link-rewritten) markdown to HTML. */
export function renderNote(markdown: string, options: RenderOptions): RenderedNote {
	const mermaid: string[] = [];
	const md = createParser(options.xhtml);
	installRules(md, options, mermaid);
	const env = {};
	const tokens = md.parse(markdown, env);
	const headings = collectHeadings(tokens, options.chapterAnchor);
	const html = md.renderer.render(tokens, md.options, env);
	return { html, headings, mermaid };
}

export const escapeHtml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
