import joplin from 'api';
import { escapeHtml } from './core/render';
import type { RenderedDiagram } from './core/sources';

type WebviewResult = { svg: string } | { png: string; width: number; height: number } | { error: string };

type Job =
	| { readonly sources: readonly string[]; readonly target: 'svg' | 'png'; readonly label: string }
	| { readonly status: string }
	| { readonly done: true; readonly summary: string };

const DIALOG_ID = 'bookExportProgress';

function decodeBase64(text: string): Uint8Array {
	return Uint8Array.from(Buffer.from(text, 'base64'));
}

function toDiagram(result: WebviewResult): RenderedDiagram {
	if ('svg' in result) return { svg: result.svg };
	if ('png' in result) return { png: decodeBase64(result.png), width: result.width, height: result.height };
	console.warn('[book-export] diagram failed to render:', result.error);
	return null;
}

/**
 * The export progress dialog. Its webview hosts the Mermaid renderer: it
 * long-polls for jobs, so one dialog serves every book in an export, shows
 * progress while it runs, and shows the summary at the end.
 */
export class ProgressDialog {
	private handle = '';
	private readonly jobs: Job[] = [];
	private waiter: ((job: Job) => void) | null = null;
	private pendingResult: ((results: WebviewResult[]) => void) | null = null;
	private closed: Promise<unknown> = Promise.resolve();

	async init(): Promise<void> {
		this.handle = await joplin.views.dialogs.create(DIALOG_ID);
		await joplin.views.dialogs.addScript(this.handle, './webview/vendor/mermaid.min.js');
		await joplin.views.dialogs.addScript(this.handle, './webview/render.js');
		await joplin.views.dialogs.addScript(this.handle, './webview/dialog.css');
		await joplin.views.dialogs.setButtons(this.handle, [{ id: 'ok', title: 'Close' }]);
		await joplin.views.panels.onMessage(this.handle, (message: { type: string; results?: WebviewResult[] }) =>
			this.onMessage(message),
		);
	}

	/** Show the dialog; diagram jobs and status lines can be queued from now on. */
	async open(title: string): Promise<void> {
		this.jobs.length = 0;
		await joplin.views.dialogs.setHtml(
			this.handle,
			`<div class="book-export"><h3>${escapeHtml(title)}</h3><p id="book-export-status">Starting…</p></div>`,
		);
		this.closed = joplin.views.dialogs.open(this.handle);
	}

	status(text: string): void {
		this.push({ status: text });
	}

	/** Render diagrams in the dialog's webview. */
	renderMermaid(sources: readonly string[], target: 'svg' | 'png', label: string): Promise<RenderedDiagram[]> {
		return new Promise((resolve) => {
			this.pendingResult = (results) => resolve(results.map(toDiagram));
			this.push({ sources, target, label });
		});
	}

	/** Show the final summary and wait for the user to close the dialog. */
	async finish(summary: string): Promise<void> {
		this.push({ done: true, summary });
		await this.closed;
	}

	private push(job: Job): void {
		if (this.waiter) {
			const deliver = this.waiter;
			this.waiter = null;
			deliver(job);
		} else {
			this.jobs.push(job);
		}
	}

	private onMessage(message: { type: string; results?: WebviewResult[] }): Promise<Job> | undefined {
		if (message.type === 'result' && this.pendingResult) {
			const done = this.pendingResult;
			this.pendingResult = null;
			done(message.results ?? []);
			return undefined;
		}
		if (message.type !== 'job') return undefined;
		const next = this.jobs.shift();
		return next ? Promise.resolve(next) : new Promise((resolve) => (this.waiter = resolve));
	}
}
