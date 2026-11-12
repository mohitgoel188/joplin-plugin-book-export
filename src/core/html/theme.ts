/**
 * Stylesheet for the HTML reader: a blog-style reading column (serif body,
 * ~70 characters per line) between a Diátaxis navigation sidebar and an
 * "On this page" panel. Light and dark themes follow the OS unless the reader
 * picks one (`data-theme` on <html>).
 */
export const READER_CSS = String.raw`
/* Marks a Diátaxis part on the first page of that part; jumping to it shows the page from the top. */
.section-anchor { display: block; scroll-margin-top: 100vh; }

:root {
  --bg: #fbfaf7; --surface: #ffffff; --panel: #f4f2ed; --fg: #22211f; --muted: #6d6a64;
  --line: #e4e0d8; --accent: #b4532a; --accent-soft: #f6e6dc; --link: #1f5f99;
  --code-bg: #f1eee8; --mark: #fff0a8; --shadow: 0 1px 2px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.06);
  --serif: Charter, "Iowan Old Style", "Source Serif Pro", "Sitka Text", Georgia, serif;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --mono: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --topbar: 56px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #161514; --surface: #1d1c1a; --panel: #1a1918; --fg: #e9e6df; --muted: #a39f97;
    --line: #2f2d2a; --accent: #e08a5f; --accent-soft: #3a261c; --link: #8cbcec;
    --code-bg: #24221f; --mark: #5a4b12; --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"] {
  --bg: #161514; --surface: #1d1c1a; --panel: #1a1918; --fg: #e9e6df; --muted: #a39f97;
  --line: #2f2d2a; --accent: #e08a5f; --accent-soft: #3a261c; --link: #8cbcec;
  --code-bg: #24221f; --mark: #5a4b12; --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
}

* { box-sizing: border-box; }
html { scroll-padding-top: calc(var(--topbar) + 16px); -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 18px/1.7 var(--serif); }
a { color: var(--link); text-underline-offset: 2px; text-decoration-thickness: 1px; }
a:hover { text-decoration-thickness: 2px; }

/* Top bar */
.topbar { position: sticky; top: 0; z-index: 20; height: var(--topbar); display: flex; align-items: center; gap: 12px;
  padding: 0 16px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line); font-family: var(--sans); }
.brand { font-weight: 650; font-size: 15px; color: var(--fg); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.icon-btn { flex: none; width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface);
  color: var(--fg); font-size: 16px; cursor: pointer; }
.icon-btn:hover { border-color: var(--accent); }
.nav-toggle { display: none; }
.search { position: relative; margin-left: auto; width: min(420px, 45vw); }
.search input { width: 100%; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line);
  background: var(--surface); color: var(--fg); font: 14px var(--sans); }
.search input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.results { position: absolute; top: 42px; right: 0; width: min(560px, 92vw); max-height: 70vh; overflow: auto; background: var(--surface);
  border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); padding: 6px; display: none; }
.results.open { display: block; }
.result { display: block; padding: 8px 10px; border-radius: 8px; color: var(--fg); text-decoration: none; }
.result:hover, .result.active { background: var(--accent-soft); }
.result b { display: block; font-size: 14px; }
.result small { display: block; color: var(--muted); font-size: 12px; }
.result span { display: block; font-size: 13px; color: var(--muted); }
.result mark { background: var(--mark); color: inherit; }

/* Three columns */
.shell { display: grid; grid-template-columns: 280px minmax(0, 1fr) 240px; align-items: start; }
.sidebar, .onpage { position: sticky; top: var(--topbar); max-height: calc(100vh - var(--topbar)); overflow: auto; font-family: var(--sans); }
.sidebar { padding: 24px 16px 40px 20px; border-right: 1px solid var(--line); background: var(--panel); min-height: calc(100vh - var(--topbar)); }
.start { display: block; padding: 12px 14px; margin-bottom: 20px; border-radius: 10px; background: var(--surface);
  border: 1px solid var(--line); text-decoration: none; color: var(--fg); }
.start small { display: block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); font-weight: 650; }
.start span { font-size: 14px; font-weight: 600; }
.start.active { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
.group { margin: 0 0 18px; }
.group h2 { margin: 0; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.group p { margin: 0 0 6px; font-size: 12px; color: var(--muted); font-style: italic; }
.group ul { list-style: none; margin: 0; padding: 0; }
.group a { display: block; padding: 5px 10px; margin: 1px 0; border-radius: 6px; font-size: 14px; line-height: 1.4; color: var(--fg); text-decoration: none; }
.group a:hover { background: var(--surface); }
.group a small { display: block; font-size: 11px; color: var(--muted); font-weight: 400; }
.group a.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.onpage { padding: 32px 16px 40px 8px; font-size: 13px; }
.onpage h2 { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
.onpage ol { list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--line); }
.onpage li a { display: block; padding: 3px 0 3px 12px; margin-left: -1px; border-left: 2px solid transparent; color: var(--muted); text-decoration: none; line-height: 1.35; }
.onpage li.l3 a { padding-left: 24px; font-size: 12px; }
.onpage li a:hover { color: var(--fg); }
.onpage li a.active { color: var(--accent); border-left-color: var(--accent); }

/* Reading column */
main { padding: 48px clamp(16px, 5vw, 64px) 96px; min-width: 0; }
.note { max-width: 74ch; margin: 0 auto; }
html.js .note { display: none; }
html.js .note.current { display: block; animation: fade .18s ease-out; }
@keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.hero { margin-bottom: 36px; padding-bottom: 24px; border-bottom: 1px solid var(--line); font-family: var(--sans); }
.eyebrow { font-size: 12px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); }
.hero h1 { font: 700 clamp(28px, 4vw, 40px)/1.15 var(--serif); margin: 8px 0 14px; letter-spacing: -.01em; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 13px; color: var(--muted); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); color: var(--muted); }
.chip.status-final { color: #1a7a1a; border-color: #1a7a1a55; }
.chip.status-draft { color: #9a7000; border-color: #9a700055; }
.chip.status-superseded { color: #a30000; border-color: #a3000055; }

.prose h2 { font: 700 26px/1.25 var(--serif); margin: 2.2em 0 .6em; letter-spacing: -.005em; }
.prose h3 { font: 650 20px/1.3 var(--sans); margin: 1.8em 0 .5em; }
.prose h4 { font: 650 17px/1.3 var(--sans); margin: 1.5em 0 .4em; }
.prose p, .prose ul, .prose ol { margin: 0 0 1.1em; }
.prose li { margin: .25em 0; }
.prose li > p { margin: 0 0 .4em; }
.prose blockquote { margin: 1.4em 0; padding: 12px 18px; border-left: 3px solid var(--accent); background: var(--panel);
  border-radius: 0 8px 8px 0; color: var(--muted); font-size: 16px; }
.prose blockquote p:last-child { margin-bottom: 0; }
.prose code { font: .84em var(--mono); background: var(--code-bg); padding: .12em .35em; border-radius: 4px; }
.prose pre { background: var(--code-bg); padding: 14px 16px; border-radius: 8px; overflow: auto; line-height: 1.5; font-size: 14px; }
.prose pre code { background: none; padding: 0; font-size: 1em; }
.prose table { display: block; overflow-x: auto; border-collapse: collapse; margin: 1.4em 0; font: 14px/1.5 var(--sans); max-width: 100%; }
.prose th { text-align: left; background: var(--panel); font-weight: 650; }
.prose th, .prose td { border: 1px solid var(--line); padding: 7px 10px; vertical-align: top; }
.prose tr:nth-child(even) td { background: color-mix(in srgb, var(--panel) 45%, transparent); }
.prose img { max-width: 100%; height: auto; border-radius: 6px; }
.prose mark { background: var(--mark); color: inherit; padding: 0 2px; }
.prose hr { border: 0; border-top: 1px solid var(--line); margin: 2.5em 0; }
.prose .task-list-item { list-style: none; }
figure.diagram { margin: 1.8em 0; padding: 16px; background: #fff; border: 1px solid var(--line); border-radius: 10px;
  overflow: auto; cursor: zoom-in; position: relative; }
figure.diagram svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
figure.diagram::after { content: "⤢ zoom"; position: absolute; top: 8px; right: 10px; font: 11px var(--sans); color: #777; opacity: 0; transition: opacity .15s; }
figure.diagram:hover::after { opacity: 1; }
.diagram-source { border-left: 3px solid var(--accent); }

.note-foot { margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--line); font-family: var(--sans); }
.backlinks h2 { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
.backlinks ul { list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-wrap: wrap; gap: 8px; }
.backlinks a { display: inline-block; font-size: 14px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; text-decoration: none; color: var(--fg); }
.backlinks a:hover { border-color: var(--accent); }
.pager { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pager a { display: block; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; text-decoration: none; color: var(--fg); background: var(--surface); }
.pager a:hover { border-color: var(--accent); }
.pager small { display: block; color: var(--muted); font-size: 12px; }
.pager .next { text-align: right; grid-column: 2; }

/* Link preview and diagram zoom */
.preview { position: absolute; z-index: 30; width: min(380px, 90vw); padding: 12px 14px; background: var(--surface); border: 1px solid var(--line);
  border-radius: 10px; box-shadow: var(--shadow); font: 13px/1.5 var(--sans); pointer-events: none; }
.preview b { display: block; font-size: 14px; margin-bottom: 2px; }
.preview small { display: block; color: var(--accent); margin-bottom: 6px; }
.zoom { position: fixed; inset: 0; z-index: 40; background: rgba(20,20,20,.86); display: none; }
.zoom.open { display: block; }
.zoom-stage { position: absolute; inset: 56px 16px 16px; overflow: auto; background: #fff; border-radius: 10px; }
.zoom-stage > div { transform-origin: 0 0; padding: 24px; width: max-content; }
.zoom-stage svg { display: block; max-width: none !important; height: auto; }
.zoom-bar { position: absolute; top: 10px; right: 16px; display: flex; gap: 8px; }
.zoom-bar button { width: 36px; height: 36px; border-radius: 8px; border: 0; background: #fff; font-size: 16px; cursor: pointer; }

/* Responsive and print */
@media (max-width: 1180px) { .shell { grid-template-columns: 260px minmax(0, 1fr); } .onpage { display: none; } }
@media (max-width: 820px) {
  .nav-toggle { display: inline-block; }
  .shell { display: block; }
  .sidebar { position: fixed; top: var(--topbar); left: 0; bottom: 0; width: min(300px, 86vw); z-index: 25; transform: translateX(-105%);
    transition: transform .2s ease; box-shadow: var(--shadow); max-height: none; }
  body.nav-open .sidebar { transform: none; }
  main { padding: 28px 16px 72px; }
  body { font-size: 17px; }
  .search { width: auto; flex: 1; }
}
@media print {
  .topbar, .sidebar, .onpage, .note-foot, figure.diagram::after { display: none !important; }
  .shell { display: block; }
  html.js .note { display: block !important; break-before: page; }
  body { background: #fff; color: #000; font-size: 12pt; }
}
`;
