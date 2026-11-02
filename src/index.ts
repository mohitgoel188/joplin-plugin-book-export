import joplin from 'api';
import { MenuItemLocation } from 'api/types';
import { exportScope } from './exporter';
import { notebookScope, notesScope } from './joplinSource';
import { askOptions, initOptionsDialog } from './optionsDialog';
import { ProgressDialog } from './progressDialog';
import { registerSettings } from './settings';

const COMMAND = {
	notebook: 'bookExport.exportNotebook',
	notes: 'bookExport.exportNotes',
} as const;

async function reportFailure(error: unknown): Promise<void> {
	console.error('[book-export] export failed:', error);
	await joplin.views.dialogs.showMessageBox(`Book export failed: ${(error as Error)?.message ?? error}`);
}

joplin.plugins.register({
	onStart: async () => {
		await registerSettings();
		await initOptionsDialog();
		const progress = new ProgressDialog();
		await progress.init();

		await joplin.commands.register({
			name: COMMAND.notebook,
			label: 'Export notebook as book (HTML / EPUB)…',
			iconName: 'fas fa-book',
			execute: async (folderId?: string) => {
				try {
					const folder = folderId
						? await joplin.data.get(['folders', folderId], { fields: ['id', 'title'] })
						: await joplin.workspace.selectedFolder();
					if (!folder) return;
					const options = await askOptions(`notebook "${folder.title}"`, true);
					if (!options) return;
					await exportScope(await notebookScope(folder.id, options.includeSubNotebooks), folder.title, options, progress);
				} catch (error) {
					await reportFailure(error);
				}
			},
		});

		await joplin.commands.register({
			name: COMMAND.notes,
			label: 'Export selected notes as book (HTML / EPUB)…',
			iconName: 'fas fa-book',
			execute: async (noteIds?: string[]) => {
				try {
					const ids = noteIds?.length ? noteIds : await joplin.workspace.selectedNoteIds();
					if (!ids.length) return;
					const options = await askOptions(`${ids.length} note(s)`, false);
					if (!options) return;
					const scope = await notesScope(ids);
					await exportScope(scope, ids.length === 1 ? scope.notes[0].title : 'Selected notes', options, progress);
				} catch (error) {
					await reportFailure(error);
				}
			},
		});

		await joplin.views.menuItems.create('bookExportNotebookContext', COMMAND.notebook, MenuItemLocation.FolderContextMenu);
		await joplin.views.menuItems.create('bookExportNotesContext', COMMAND.notes, MenuItemLocation.NoteListContextMenu);
		await joplin.views.menuItems.create('bookExportNotebookTools', COMMAND.notebook, MenuItemLocation.Tools);
	},
});
