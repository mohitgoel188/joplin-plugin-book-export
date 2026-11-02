import { describe, expect, it } from 'vitest';
import { groupIntoBooks, UNLINKED_TITLE } from '../src/core/grouping';
import { link, nid, note, notebook } from './fixtures';

const titles = (notes: readonly { title: string }[]) => notes.map((n) => n.title);

describe('groupIntoBooks — linked mode', () => {
	it('joins a note that only receives links into its set', () => {
		const books = groupIntoBooks(
			[note('hub', `${link('design')} ${link('java')}`), note('design', link('hub')), note('java', 'no links')],
			[notebook('nb1')],
			'linked',
		);
		expect(books).toHaveLength(1);
		expect(books[0].kind).toBe('linked');
		expect(titles(books[0].notes).sort()).toEqual(['design', 'hub', 'java']);
	});

	it('treats a chain A-B-C as one book', () => {
		const books = groupIntoBooks([note('a', link('b')), note('b', link('c')), note('c', '')], [], 'linked');
		expect(books).toHaveLength(1);
		expect(books[0].notes).toHaveLength(3);
	});

	it('puts the hub first and follows its links in body order', () => {
		const books = groupIntoBooks(
			[
				note('ref', link('hub')),
				note('design', link('hub')),
				note('hub', `${link('design')} then ${link('ref')} then ${link('java')}`),
				note('java', ''),
			],
			[],
			'linked',
		);
		expect(titles(books[0].notes)).toEqual(['hub', 'design', 'ref', 'java']);
		expect(books[0].title).toBe('hub');
	});

	it('breaks an out-degree tie by incoming links', () => {
		const books = groupIntoBooks(
			[note('golive', `${link('hub')} ${link('qa')}`), note('hub', `${link('golive')} ${link('qa')}`), note('qa', link('hub'))],
			[],
			'linked',
		);
		expect(books[0].notes[0].title).toBe('hub');
	});

	it('ignores self-links and links to notes outside the scope', () => {
		const books = groupIntoBooks([note('a', `${link('a', 'x')} ${link('zz')}`), note('b', '')], [notebook('nb1')], 'linked');
		expect(books).toHaveLength(1);
		expect(books[0].kind).toBe('unlinked');
	});

	it('gathers unlinked notes into one book per notebook', () => {
		const books = groupIntoBooks(
			[note('x', link('y')), note('y', ''), note('lone2', '', 'nb1'), note('lone1', '', 'nb1'), note('solo', '', 'nb2')],
			[notebook('nb1'), notebook('nb2')],
			'linked',
		);
		expect(books.map((b) => [b.kind, b.title])).toEqual([
			['linked', 'x'],
			['unlinked', `${UNLINKED_TITLE} — nb1`],
			['single', 'solo'],
		]);
		expect(titles(books[1].notes)).toEqual(['lone1', 'lone2']);
	});

	it('ignores links to resources', () => {
		const body = `![img](:/${nid('res')})`;
		const books = groupIntoBooks([note('a', body), note('b', body)], [], 'linked');
		expect(books.every((b) => b.kind !== 'linked')).toBe(true);
	});
});

describe('groupIntoBooks — other modes', () => {
	const notes = [note('b', link('a')), note('a', ''), note('z', ''), note('c', '')];

	it('whole: one book, linked sets first then unlinked by title', () => {
		const books = groupIntoBooks(notes, [], 'whole', 'My notebook');
		expect(books).toHaveLength(1);
		expect(books[0].title).toBe('My notebook');
		expect(titles(books[0].notes)).toEqual(['b', 'a', 'c', 'z']);
	});

	it('perNote: one book per note, sorted by title', () => {
		const books = groupIntoBooks(notes, [], 'perNote');
		expect(books.map((b) => b.title)).toEqual(['a', 'b', 'c', 'z']);
		expect(books.every((b) => b.kind === 'single')).toBe(true);
	});
});
