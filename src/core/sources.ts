/**
 * What the book builders need from the outside world. The plugin implements
 * this over the Joplin data API and a webview; tests pass in-memory fakes.
 */

export interface Resource {
	readonly id: string;
	readonly mime: string;
	/** File extension without the dot, e.g. `png`. */
	readonly extension: string;
	readonly data: Uint8Array;
}

/** A rendered diagram: SVG markup for HTML, PNG bytes for EPUB; null when rendering failed. */
export type RenderedDiagram = { readonly svg: string } | { readonly png: Uint8Array; readonly width: number; readonly height: number } | null;

export interface BookSources {
	/** The attachment with this id, or null when the id is not an attachment (e.g. a note outside the book). */
	loadResource(id: string): Promise<Resource | null>;
	/** Title of a note that is not in the book, for link text. */
	noteTitle(id: string): Promise<string | undefined>;
	/** Render every diagram, in order. */
	renderMermaid(sources: readonly string[], target: 'svg' | 'png'): Promise<RenderedDiagram[]>;
}

export function toBase64(data: Uint8Array): string {
	if (typeof Buffer !== 'undefined') return Buffer.from(data).toString('base64');
	let binary = '';
	for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
	return btoa(binary);
}
