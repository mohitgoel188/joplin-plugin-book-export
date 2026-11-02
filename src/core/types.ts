/**
 * Plain data shapes shared by the export pipeline.
 *
 * The core never talks to the Joplin API. Everything it needs arrives as these
 * records, so the grouping, ordering and link-rewriting logic runs (and is
 * tested) in plain Node.
 */

export interface NoteRecord {
	readonly id: string;
	readonly title: string;
	readonly body: string;
	/** Id of the notebook (folder) that holds the note. */
	readonly parentId: string;
	/** Tag titles, e.g. `diataxis/how-to`, `repo/web-app`. */
	readonly tags?: readonly string[];
	/** Last time the user edited the note, ms since epoch. */
	readonly updatedTime?: number;
}

export interface NotebookRecord {
	readonly id: string;
	readonly title: string;
	readonly parentId: string;
}

export type BookKind = 'linked' | 'unlinked' | 'single' | 'whole';

/** One output file: an ordered run of notes rendered as chapters. */
export interface Book {
	readonly title: string;
	readonly kind: BookKind;
	/** Chapter order. The first note is the hub for a linked book. */
	readonly notes: readonly NoteRecord[];
}

export type GroupingMode = 'linked' | 'whole' | 'perNote';

/** A link found in a note body: `[text](:/<targetId>#<anchor>)`. */
export interface NoteLink {
	readonly targetId: string;
	readonly anchor: string | null;
	/** Character offset of the link in the body; used for ordering. */
	readonly index: number;
}
