import joplin from 'api';
import { plainTitle } from './core/emoji';
import { bookIdFor, buildEpubBook } from './core/epubBook';
import { groupIntoBooks } from './core/grouping';
import { buildHtmlBook } from './core/htmlBook';
import type { Book } from './core/types';
import { joplinBookSources, type Scope } from './joplinSource';
import type { ProgressDialog } from './progressDialog';
import { type ExportOptions, SETTING } from './settings';

const MAX_NAME = 120;

/** A file name from a book title: no emoji, no path separators or characters Windows rejects. */
export function fileNameFor(title: string): string {
	const name = plainTitle(title).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
	return (name || 'Notes').slice(0, MAX_NAME);
}

async function outputDir(): Promise<string | null> {
	const configured = String(await joplin.settings.value(SETTING.outputDir) ?? '').trim();
	if (configured) return configured;
	const picked = await joplin.views.dialogs.showOpenDialog({ title: 'Choose where to save exported books', properties: ['openDirectory', 'createDirectory'] });
	if (!picked?.length) return null;
	await joplin.settings.setValue(SETTING.outputDir, picked[0]);
	return picked[0];
}

/** `name.ext`, or `name (2).ext` and so on when this export already wrote that name. */
function uniquePath(dir: string, name: string, ext: string, used: Set<string>): string {
	let candidate = `${name}.${ext}`;
	for (let n = 2; used.has(candidate); n++) candidate = `${name} (${n}).${ext}`;
	used.add(candidate);
	return `${dir}/${candidate}`;
}

const formatsFor = (options: ExportOptions): Array<'html' | 'epub'> =>
	options.format === 'both' ? ['html', 'epub'] : [options.format];

async function writeBook(book: Book, format: 'html' | 'epub', path: string, options: ExportOptions, progress: ProgressDialog): Promise<void> {
	const fs = joplin.require('fs-extra');
	const label = `${plainTitle(book.title)} (${format.toUpperCase()})`;
	progress.status(`${label}: preparing`);
	const sources = joplinBookSources((src, target) => progress.renderMermaid(src, target, label));
	if (format === 'html') {
		await fs.writeFile(path, await buildHtmlBook(book, sources, options.layout), 'utf8');
	} else {
		await fs.writeFile(path, Buffer.from(await buildEpubBook(book, sources, { bookId: bookIdFor(book) })));
	}
}

/** Group the scope into books and write each in the chosen format(s), reporting progress in the dialog. */
export async function exportScope(scope: Scope, scopeTitle: string, options: ExportOptions, progress: ProgressDialog): Promise<void> {
	if (!scope.notes.length) {
		await joplin.views.dialogs.showMessageBox(`"${scopeTitle}" has no notes to export.`);
		return;
	}
	const dir = await outputDir();
	if (!dir) return;
	await joplin.require('fs-extra').ensureDir(dir);

	const books = groupIntoBooks(scope.notes, scope.notebooks, options.grouping, scopeTitle);
	await progress.open(`Exporting ${scopeTitle}`);
	const used = new Set<string>();
	const written: string[] = [];
	const failed: string[] = [];
	for (const book of books) {
		for (const format of formatsFor(options)) {
			const path = uniquePath(dir, fileNameFor(book.title), format, used);
			try {
				await writeBook(book, format, path, options, progress);
				written.push(path.slice(dir.length + 1));
			} catch (error) {
				console.error(`[book-export] failed to export "${book.title}" as ${format}:`, error);
				failed.push(`${plainTitle(book.title)} (${format}): ${(error as Error)?.message ?? error}`);
			}
		}
	}
	const lines = [`Saved ${written.length} file(s) to ${dir}:`, ...written.map((f) => `  • ${f}`)];
	if (failed.length) lines.push('', `Failed (${failed.length}):`, ...failed.map((f) => `  • ${f}`));
	await progress.finish(lines.join('\n'));
}
