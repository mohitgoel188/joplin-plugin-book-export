import { describe, expect, it } from 'vitest';
import { AnchorPlan, noteAnchor } from '../src/core/anchors';
import { emojiToText, plainTitle } from '../src/core/emoji';
import { extractLinks } from '../src/core/links';
import { joplinNoteUrl, type LinkTargets, rewriteNoteLinks } from '../src/core/rewriteLinks';
import { link, nid, note } from './fixtures';

describe('extractLinks', () => {
	it('finds links with anchors and titles, in order', () => {
		const body = `${link('a', 'h-x')} and [t](:/${nid('b')} "tip") and ![i](:/${nid('r')})`;
		expect(extractLinks(body).map((l) => [l.targetId, l.anchor])).toEqual([
			[nid('a'), 'h-x'],
			[nid('b'), null],
			[nid('r'), null],
		]);
	});
});

describe('AnchorPlan', () => {
	const a = note('a', '## One {#h-one}\n## Shared {#toc}');
	const b = note('b', '## Shared {#toc}\n## Two {#b-two}');
	const plan = new AnchorPlan([a, b]);

	it('keeps unique ids as written', () => {
		expect(plan.resolve(a.id, 'h-one')).toBe('h-one');
		expect(plan.resolve(b.id, 'b-two')).toBe('b-two');
	});

	it('prefixes ids that clash across notes', () => {
		expect(plan.resolve(a.id, 'toc')).toBe(`n${a.id.slice(0, 8)}-toc`);
		expect(plan.resolve(b.id, 'toc')).toBe(`n${b.id.slice(0, 8)}-toc`);
		expect(plan.applyTo(b)).toContain(`{#n${b.id.slice(0, 8)}-toc}`);
	});

	it('falls back to the chapter anchor', () => {
		expect(plan.resolve(a.id, null)).toBe(noteAnchor(a.id));
		expect(plan.resolve(a.id, 'missing')).toBe(noteAnchor(a.id));
	});
});

describe('rewriteNoteLinks', () => {
	const a = note('a', '## H {#h}');
	const targets = (overrides: Partial<LinkTargets> = {}): LinkTargets => ({
		chapterFile: new Map([[a.id, 'ch01.xhtml']]),
		anchors: new AnchorPlan([a]),
		resourceIds: new Set([nid('res')]),
		outsideTitle: (id) => (id === nid('out') ? 'Other note' : undefined),
		outside: 'plainText',
		...overrides,
	});

	it('points in-book links at the chapter file and anchor', () => {
		expect(rewriteNoteLinks(link('a', 'h', 'go'), targets())).toBe('[go](ch01.xhtml#h)');
		expect(rewriteNoteLinks(link('a', undefined, 'go'), targets())).toBe(`[go](ch01.xhtml#${noteAnchor(a.id)})`);
	});

	it('uses a same-page anchor when the chapter file is empty', () => {
		const t = targets({ chapterFile: new Map([[a.id, '']]) });
		expect(rewriteNoteLinks(link('a', 'h', 'go'), t)).toBe('[go](#h)');
	});

	it('turns outside links into text or joplin:// links', () => {
		expect(rewriteNoteLinks(link('out', undefined, 'go'), targets())).toBe('go (Joplin: Other note)');
		expect(rewriteNoteLinks(link('out', undefined, 'Other note'), targets())).toBe('Other note');
		expect(rewriteNoteLinks(link('out', undefined, 'go'), targets({ outside: 'joplinUrl' }))).toBe(
			`[go](${joplinNoteUrl(nid('out'))})`,
		);
	});

	it('leaves resource links and images alone', () => {
		const body = `[file](:/${nid('res')}) ![img](:/${nid('a')})`;
		expect(rewriteNoteLinks(body, targets())).toBe(body);
	});
});

describe('emoji', () => {
	it('labels known markers and drops the rest', () => {
		expect(emojiToText('🚨 bad ✅ ok 🏍️ x')).toBe('[!!] bad [OK] ok  x');
		expect(plainTitle('📦 PROJ-42 — Widget resize')).toBe('PROJ-42 — Widget resize');
	});
});
