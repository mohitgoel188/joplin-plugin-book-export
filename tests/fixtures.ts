import type { NotebookRecord, NoteRecord } from '../src/core/types';

/** A deterministic 32-hex id from a short name (≤ 16 chars), so fixtures read naturally. */
export const nid = (name: string) => Buffer.from(name).toString('hex').padEnd(32, '0').slice(0, 32);

export const link = (to: string, anchor?: string, text = 'see') => `[${text}](:/${nid(to)}${anchor ? `#${anchor}` : ''})`;

export const note = (name: string, body: string, parent = 'nb1'): NoteRecord => ({
	id: nid(name),
	title: name,
	body,
	parentId: nid(parent),
});

export const notebook = (name: string): NotebookRecord => ({ id: nid(name), title: name, parentId: '' });
