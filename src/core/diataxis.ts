import type { NoteRecord } from './types';

/**
 * Diátaxis document types (https://diataxis.fr): what the reader needs from a note.
 * `other` holds notes that neither a tag nor the title places.
 */
export type DocType = 'tutorial' | 'how-to' | 'reference' | 'explanation' | 'other';

export interface DocTypeInfo {
	readonly type: DocType;
	/** Navigation heading. */
	readonly label: string;
	/** What the reader is doing, shown under the heading. */
	readonly need: string;
}

/** Display order follows the Diátaxis map: learning, doing, looking up, understanding. */
export const DOC_TYPES: readonly DocTypeInfo[] = [
	{ type: 'tutorial', label: 'Tutorials', need: 'Learn by doing' },
	{ type: 'how-to', label: 'How-to guides', need: 'Get a task done' },
	{ type: 'reference', label: 'Reference', need: 'Look something up' },
	{ type: 'explanation', label: 'Explanation', need: 'Understand why' },
	{ type: 'other', label: 'Other notes', need: '' },
];

export const TAG_PREFIX = 'diataxis/';

const TAG_ALIASES: Readonly<Record<string, DocType>> = {
	tutorial: 'tutorial',
	tutorials: 'tutorial',
	'how-to': 'how-to',
	howto: 'how-to',
	'how-to-guide': 'how-to',
	reference: 'reference',
	explanation: 'explanation',
};

/** Title words that imply a type, checked in this order; the first match wins. */
const TITLE_RULES: ReadonlyArray<readonly [RegExp, DocType]> = [
	[/\b(tutorial|walkthrough|getting started|onboarding|learn)\b/i, 'tutorial'],
	[/\b(how[- ]to|runbook|playbook|go-live|checklist|test plan|qa plan|steps|procedure|migration plan|rollout)\b/i, 'how-to'],
	[/\b(reference|glossary|schema|spec|api|contract|cheat ?sheet|register|catalog(ue)?)\b/i, 'reference'],
	[/\b(design|architecture|overview|explanation|analysis|why|rationale|concepts?|background|decision)\b/i, 'explanation'],
];

/** A note's type: a `diataxis/<type>` tag wins, then words in the title, else `other`. */
export function docTypeOf(note: NoteRecord): DocType {
	for (const tag of note.tags ?? []) {
		if (!tag.toLowerCase().startsWith(TAG_PREFIX)) continue;
		const type = TAG_ALIASES[tag.slice(TAG_PREFIX.length).toLowerCase()];
		if (type) return type;
	}
	return TITLE_RULES.find(([pattern]) => pattern.test(note.title))?.[1] ?? 'other';
}
