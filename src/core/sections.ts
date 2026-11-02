/** A level-2 heading that opens a hand-written contents list: `## Contents`, `## Table of contents {#x}`, `## TOC`. */
const CONTENTS_HEADING = /^##[ \t]+(contents|table of contents|toc)[ \t]*(\{[^}]*\})?[ \t]*$/i;
const H1_OR_H2 = /^#{1,2}[ \t]/;
const FENCE = /^[ \t]*(```|~~~)/;

/**
 * Drop a note's own "Contents" section (heading through to the next `#`/`##`
 * heading). The HTML reader builds its own "On this page" panel, so a
 * hand-maintained list would only repeat it. Headings inside code fences are ignored.
 */
export function stripContentsSection(markdown: string): string {
	const lines = markdown.split('\n');
	const kept: string[] = [];
	let inFence = false;
	let skipping = false;
	for (const line of lines) {
		if (FENCE.test(line)) inFence = !inFence;
		if (!inFence && skipping && H1_OR_H2.test(line)) skipping = false;
		if (!inFence && !skipping && CONTENTS_HEADING.test(line)) {
			skipping = true;
			continue;
		}
		if (!skipping) kept.push(line);
	}
	return kept.join('\n');
}

const WORDS_PER_MINUTE = 220;

/** Rough reading time in whole minutes (at least 1), ignoring code fences and markup. */
export function readingMinutes(markdown: string): number {
	const prose = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`>|\-[\]()]/g, ' ');
	const words = prose.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
