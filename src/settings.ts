import joplin from 'api';
import { SettingItemSubType, SettingItemType } from 'api/types';
import type { LayoutChoice } from './core/htmlBook';
import type { GroupingMode } from './core/types';

export const SECTION = 'bookExport';

export const SETTING = {
	outputDir: 'bookExport.outputDir',
	lastFormat: 'bookExport.lastFormat',
	lastGrouping: 'bookExport.lastGrouping',
	lastLayout: 'bookExport.lastLayout',
	includeSubNotebooks: 'bookExport.includeSubNotebooks',
} as const;

export type ExportFormat = 'html' | 'epub' | 'both';

export async function registerSettings(): Promise<void> {
	await joplin.settings.registerSection(SECTION, {
		label: 'Book Export',
		iconName: 'fas fa-book',
		description: 'Export a notebook or a set of linked notes as a single HTML page or EPUB book.',
	});
	await joplin.settings.registerSettings({
		[SETTING.outputDir]: {
			section: SECTION,
			public: true,
			type: SettingItemType.String,
			subType: SettingItemSubType.DirectoryPath,
			value: '',
			label: 'Output folder',
			description: 'Where exported books are saved. Left empty, you are asked on the first export.',
		},
		[SETTING.lastFormat]: { section: SECTION, public: false, type: SettingItemType.String, value: 'html', label: 'Last format' },
		[SETTING.lastGrouping]: { section: SECTION, public: false, type: SettingItemType.String, value: 'linked', label: 'Last grouping' },
		[SETTING.lastLayout]: { section: SECTION, public: false, type: SettingItemType.String, value: 'auto', label: 'Last HTML layout' },
		[SETTING.includeSubNotebooks]: {
			section: SECTION,
			public: false,
			type: SettingItemType.Bool,
			value: true,
			label: 'Include sub-notebooks',
		},
	});
}

export interface ExportOptions {
	readonly format: ExportFormat;
	readonly grouping: GroupingMode;
	/** HTML only: Diátaxis groups, a blog list, or auto (Diátaxis when notes carry diataxis/* tags). */
	readonly layout: LayoutChoice;
	readonly includeSubNotebooks: boolean;
}

export async function lastOptions(): Promise<ExportOptions> {
	return {
		format: (await joplin.settings.value(SETTING.lastFormat)) as ExportFormat,
		grouping: (await joplin.settings.value(SETTING.lastGrouping)) as GroupingMode,
		layout: ((await joplin.settings.value(SETTING.lastLayout)) || 'auto') as LayoutChoice,
		includeSubNotebooks: Boolean(await joplin.settings.value(SETTING.includeSubNotebooks)),
	};
}

export async function rememberOptions(options: ExportOptions): Promise<void> {
	await joplin.settings.setValue(SETTING.lastFormat, options.format);
	await joplin.settings.setValue(SETTING.lastGrouping, options.grouping);
	await joplin.settings.setValue(SETTING.lastLayout, options.layout);
	await joplin.settings.setValue(SETTING.includeSubNotebooks, options.includeSubNotebooks);
}
