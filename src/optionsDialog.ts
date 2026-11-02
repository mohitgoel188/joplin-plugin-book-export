import joplin from 'api';
import type { LayoutChoice } from './core/htmlBook';
import { escapeHtml } from './core/render';
import type { GroupingMode } from './core/types';
import { type ExportFormat, type ExportOptions, lastOptions, rememberOptions } from './settings';

const DIALOG_ID = 'bookExportOptions';

const FORMATS: ReadonlyArray<readonly [ExportFormat, string]> = [
	['html', 'HTML — one self-contained page'],
	['epub', 'EPUB — e-reader book (Kindle / KOReader)'],
	['both', 'Both'],
];

const GROUPINGS: ReadonlyArray<readonly [GroupingMode, string]> = [
	['linked', 'One book per set of linked notes; unlinked notes together'],
	['whole', 'Everything in one book'],
	['perNote', 'One file per note'],
];

const LAYOUTS: ReadonlyArray<readonly [LayoutChoice, string]> = [
	['auto', 'Auto — Diátaxis when notes are tagged diataxis/*, otherwise blog'],
	['diataxis', 'Diátaxis — grouped as tutorials, how-to, reference, explanation'],
	['blog', 'Blog — one dated list of notes'],
];

const radios = <T extends string>(name: string, options: ReadonlyArray<readonly [T, string]>, checked: T) =>
	options
		.map(
			([value, label]) =>
				`<label><input type="radio" name="${name}" value="${value}"${value === checked ? ' checked' : ''}> ${escapeHtml(label)}</label>`,
		)
		.join('');

let handle = '';

export async function initOptionsDialog(): Promise<void> {
	handle = await joplin.views.dialogs.create(DIALOG_ID);
	await joplin.views.dialogs.addScript(handle, './webview/dialog.css');
	await joplin.views.dialogs.setButtons(handle, [
		{ id: 'export', title: 'Export' },
		{ id: 'cancel', title: 'Cancel' },
	]);
}

/** Ask how to export; null when cancelled. `scopeLabel` names what is being exported. */
export async function askOptions(scopeLabel: string, isNotebook: boolean): Promise<ExportOptions | null> {
	const last = await lastOptions();
	const subNotebooks = isNotebook
		? `<label><input type="checkbox" name="includeSubNotebooks" value="1"${last.includeSubNotebooks ? ' checked' : ''}> Include sub-notebooks</label>`
		: '';
	await joplin.views.dialogs.setHtml(
		handle,
		`<form name="options" class="book-export">
			<h3>Export ${escapeHtml(scopeLabel)}</h3>
			<fieldset><legend>Format</legend>${radios('format', FORMATS, last.format)}</fieldset>
			<fieldset><legend>Grouping</legend>${radios('grouping', GROUPINGS, last.grouping)}</fieldset>
			<fieldset><legend>HTML layout</legend>${radios('layout', LAYOUTS, last.layout)}</fieldset>
			${subNotebooks}
		</form>`,
	);
	const result = await joplin.views.dialogs.open(handle);
	if (result.id !== 'export') return null;
	const form = result.formData?.options ?? {};
	const options: ExportOptions = {
		format: FORMATS.some(([v]) => v === form.format) ? form.format : last.format,
		grouping: GROUPINGS.some(([v]) => v === form.grouping) ? form.grouping : last.grouping,
		layout: LAYOUTS.some(([v]) => v === form.layout) ? form.layout : last.layout,
		includeSubNotebooks: isNotebook ? form.includeSubNotebooks === '1' : last.includeSubNotebooks,
	};
	await rememberOptions(options);
	return options;
}
