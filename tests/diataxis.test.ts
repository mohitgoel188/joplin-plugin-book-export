import { describe, expect, it } from 'vitest';
import { docTypeOf } from '../src/core/diataxis';
import { readerOrder, resolveLayout, shortTitle } from '../src/core/htmlBook';
import { readingMinutes, stripContentsSection } from '../src/core/sections';
import type { Chapter } from '../src/core/chapters';
import type { Book, NoteRecord } from '../src/core/types';
import { note } from './fixtures';

const tagged = (title: string, tags: string[] = []): NoteRecord => ({ ...note(title.slice(0, 16), ''), title, tags });

describe('docTypeOf', () => {
	it('prefers a diataxis tag over the title', () => {
		expect(docTypeOf(tagged('Service design', ['repo/x', 'diataxis/reference']))).toBe('reference');
		expect(docTypeOf(tagged('Anything', ['Diataxis/How-To']))).toBe('how-to');
	});

	it('falls back to words in the title, then other', () => {
		expect(docTypeOf(tagged('X go-live'))).toBe('how-to');
		expect(docTypeOf(tagged('X QA test plan'))).toBe('how-to');
		expect(docTypeOf(tagged('X Java checklist'))).toBe('how-to');
		expect(docTypeOf(tagged('X design'))).toBe('explanation');
		expect(docTypeOf(tagged('X reference'))).toBe('reference');
		expect(docTypeOf(tagged('Getting started with X'))).toBe('tutorial');
		expect(docTypeOf(tagged('Product size change'))).toBe('other');
		expect(docTypeOf(tagged('X', ['diataxis/unknown']))).toBe('other');
	});
});

describe('stripContentsSection', () => {
	it('drops the Contents section up to the next h2', () => {
		const md = '> header\n\n## Contents {#g-toc}\n\n- [a](#a)\n- [b](#b)\n\n## A {#a}\n\ntext';
		expect(stripContentsSection(md)).toBe('> header\n\n## A {#a}\n\ntext');
	});

	it('keeps a nested ### and ignores headings inside code fences', () => {
		const md = '## Table of contents\n\n### sub\n\n```\n## Contents\n```\n\n## Next\n\nx';
		expect(stripContentsSection(md)).toBe('## Next\n\nx');
		expect(stripContentsSection('```\n## Contents\n```\nx')).toBe('```\n## Contents\n```\nx');
	});

	it('leaves notes without a Contents section alone', () => {
		expect(stripContentsSection('## Intro\n\ntext')).toBe('## Intro\n\ntext');
	});
});

describe('reader helpers', () => {
	it('estimates reading time, at least one minute', () => {
		expect(readingMinutes('word '.repeat(660))).toBe(3);
		expect(readingMinutes('tiny')).toBe(1);
	});

	it('shortens titles that repeat the book title', () => {
		const book = '📦 PROJ-42 — Widget resize';
		expect(shortTitle('📦 PROJ-42 — Widget resize go-live', book)).toBe('Go-live');
		expect(shortTitle('📦 PROJ-42 — Widget resize', book)).toBe('📦 PROJ-42 — Widget resize');
		expect(shortTitle('Unrelated', book)).toBe('Unrelated');
	});

	it('orders hub first, then Diátaxis groups in map order', () => {
		const notes = [tagged('Hub'), tagged('Hub design'), tagged('Hub go-live'), tagged('Hub glossary'), tagged('Hub misc')];
		const chapters = notes.map((n) => ({ note: n, title: n.title, anchor: n.id, html: '', headings: [] }) as Chapter);
		const book: Book = { title: 'Hub', kind: 'linked', notes };
		const { start, groups } = readerOrder(book, chapters);
		expect(start?.chapter.title).toBe('Hub');
		expect(groups.map((g) => [g.label, g.entries.map((e) => e.navTitle)])).toEqual([
			['How-to guides', ['Go-live']],
			['Reference', ['Glossary']],
			['Explanation', ['Design']],
			['Other notes', ['Misc']],
		]);
	});

	it('blog layout: one Notes list in book order, no Start here', () => {
		const notes = [tagged('Hub'), tagged('Hub design'), tagged('Hub go-live')];
		const chapters = notes.map((n) => ({ note: n, title: n.title, anchor: n.id, html: '', headings: [] }) as Chapter);
		const { start, groups } = readerOrder({ title: 'Hub', kind: 'linked', notes }, chapters, 'blog');
		expect(start).toBeNull();
		expect(groups.map((g) => [g.label, g.entries.length])).toEqual([['Notes', 3]]);
	});

	it('auto layout picks Diátaxis only when a note carries a diataxis tag', () => {
		const plain: Book = { title: 'x', kind: 'whole', notes: [tagged('A plan', ['status/draft']), tagged('B design')] };
		const typed: Book = { ...plain, notes: [...plain.notes, tagged('C', ['diataxis/reference'])] };
		expect(resolveLayout(plain, 'auto')).toBe('blog');
		expect(resolveLayout(typed, 'auto')).toBe('diataxis');
		expect(resolveLayout(typed, 'blog')).toBe('blog');
	});
});
