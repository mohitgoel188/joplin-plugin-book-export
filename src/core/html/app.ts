/**
 * Script for the HTML reader. Shows one note at a time (hash routing; every
 * `#anchor` link opens the note that owns the anchor), builds the "On this page"
 * panel with scroll-spy, client-side search, link previews, diagram zoom and a
 * theme toggle. Without JavaScript every note stays visible as one long page.
 */
export const READER_JS = String.raw`
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var notes = Array.prototype.slice.call(document.querySelectorAll('article.note'));
  if (!notes.length) return;
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-note-link]'));
  var onpage = document.querySelector('.onpage ol');
  var current = null;
  var spy = null;

  function store(key, value) {
    try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch (e) { return null; }
  }

  /* ---------- routing ---------- */
  function noteFor(el) { return el ? el.closest('article.note') : null; }

  function headingsOf(note) {
    return Array.prototype.slice.call(note.querySelectorAll('.prose h2[id], .prose h3[id]'));
  }

  function buildOnPage(note) {
    if (!onpage) return;
    onpage.innerHTML = '';
    headingsOf(note).forEach(function (h) {
      var li = document.createElement('li');
      li.className = h.tagName === 'H3' ? 'l3' : 'l2';
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      onpage.appendChild(li);
    });
    onpage.parentElement.style.visibility = onpage.children.length ? 'visible' : 'hidden';
  }

  function watchHeadings(note) {
    if (spy) spy.disconnect();
    if (!('IntersectionObserver' in window) || !onpage) return;
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Array.prototype.forEach.call(onpage.querySelectorAll('a'), function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-64px 0px -70% 0px' });
    headingsOf(note).forEach(function (h) { spy.observe(h); });
  }

  function show(note, target) {
    if (note !== current) {
      notes.forEach(function (n) { n.classList.toggle('current', n === note); });
      current = note;
      navLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-note-link') === note.id); });
      buildOnPage(note);
      watchHeadings(note);
      document.title = note.getAttribute('data-title') + ' · ' + document.body.getAttribute('data-book');
    }
    document.body.classList.remove('nav-open');
    // A section-anchor marks a part (e.g. "How-to guides") whose first page this is: show the page from the top.
    if (target && target !== note.querySelector('.hero h1') && !target.classList.contains('section-anchor')) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  function route() {
    var id = decodeURIComponent(location.hash.slice(1));
    var target = id ? document.getElementById(id) : null;
    show(noteFor(target) || current || notes[0], target);
  }

  window.addEventListener('hashchange', route);
  // Opening the file with a #fragment: the browser jumps to it after this script has run; route again.
  window.addEventListener('load', function () { if (location.hash) route(); });
  document.addEventListener('click', function (event) {
    var a = event.target.closest('a[href^="#"]');
    if (!a) return;
    // A click on the link already in the address bar fires no hashchange; route anyway.
    if (a.getAttribute('href') === location.hash) { event.preventDefault(); route(); }
  });
  route();

  /* ---------- search ---------- */
  var index = [];
  notes.forEach(function (note) {
    var title = note.getAttribute('data-title');
    var section = { note: note, title: title, id: note.querySelector('.hero h1').id, heading: '', text: '' };
    index.push(section);
    Array.prototype.forEach.call(note.querySelector('.prose').children, function (el) {
      // Diagram SVGs carry their own CSS and node labels; they make noisy search hits.
      if (el.matches('figure.diagram, .diagram-source')) return;
      if (/^H[23]$/.test(el.tagName) && el.id) {
        section = { note: note, title: title, id: el.id, heading: el.textContent, text: '' };
        index.push(section);
      } else {
        section.text += ' ' + el.textContent;
      }
    });
  });

  var input = document.querySelector('.search input');
  var results = document.querySelector('.results');
  var picked = 0;

  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function highlight(s, terms) {
    var out = escapeHtml(s);
    terms.forEach(function (t) { out = out.replace(new RegExp('(' + t.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return out;
  }
  function snippet(text, term) {
    var clean = text.replace(/\s+/g, ' ').trim();
    var at = clean.toLowerCase().indexOf(term);
    var start = Math.max(0, at - 60);
    return (start ? '…' : '') + clean.slice(start, start + 170) + (clean.length > start + 170 ? '…' : '');
  }

  function search(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { results.classList.remove('open'); return; }
    var hits = index.map(function (s) {
      var hay = (s.title + ' ' + s.heading + ' ' + s.text).toLowerCase();
      if (!terms.every(function (t) { return hay.indexOf(t) >= 0; })) return null;
      var score = 0;
      terms.forEach(function (t) {
        if (s.heading.toLowerCase().indexOf(t) >= 0) score += 4;
        if (s.title.toLowerCase().indexOf(t) >= 0) score += 2;
        score += Math.min(3, (s.text.toLowerCase().split(t).length - 1));
      });
      return { s: s, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 12);
    picked = 0;
    results.innerHTML = hits.length ? hits.map(function (h, i) {
      return '<a class="result' + (i === 0 ? ' active' : '') + '" href="#' + h.s.id + '"><b>' + highlight(h.s.heading || h.s.title, terms) +
        '</b>' + (h.s.heading ? '<small>' + escapeHtml(h.s.title) + '</small>' : '') + '<span>' + highlight(snippet(h.s.text, terms[0]), terms) + '</span></a>';
    }).join('') : '<div class="result"><span>No matches</span></div>';
    results.classList.add('open');
  }

  if (input && results) {
    input.addEventListener('input', function () { search(input.value); });
    input.addEventListener('keydown', function (event) {
      var items = results.querySelectorAll('a.result');
      if (event.key === 'Escape') { input.value = ''; results.classList.remove('open'); input.blur(); }
      if (!items.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        items[picked].classList.remove('active');
        picked = (picked + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        items[picked].classList.add('active');
      }
      if (event.key === 'Enter') { event.preventDefault(); items[picked].click(); }
    });
    results.addEventListener('click', function (event) { if (event.target.closest('a')) results.classList.remove('open'); });
    document.addEventListener('keydown', function (event) {
      if (event.key === '/' && document.activeElement !== input) { event.preventDefault(); input.focus(); }
    });
    document.addEventListener('click', function (event) { if (!event.target.closest('.search')) results.classList.remove('open'); });
  }

  /* ---------- link preview ---------- */
  var preview = document.createElement('div');
  preview.className = 'preview';
  preview.hidden = true;
  document.body.appendChild(preview);
  var previewTimer = null;

  function sectionFor(id) {
    for (var i = 0; i < index.length; i++) if (index[i].id === id) return index[i];
    var el = document.getElementById(id);
    var note = noteFor(el);
    if (!note) return null;
    for (var j = 0; j < index.length; j++) if (index[j].note === note) return index[j];
    return null;
  }

  document.addEventListener('mouseover', function (event) {
    var a = event.target.closest('.prose a[href^="#"]');
    if (!a) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      var s = sectionFor(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (!s || s.note === current && !s.heading) return;
      preview.innerHTML = '<b>' + escapeHtml(s.heading || s.title) + '</b>' + (s.heading ? '<small>' + escapeHtml(s.title) + '</small>' : '') +
        escapeHtml(snippet(s.text, '').slice(0, 260));
      var r = a.getBoundingClientRect();
      preview.style.left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 400) + 'px';
      preview.style.top = window.scrollY + r.bottom + 8 + 'px';
      preview.hidden = false;
    }, 350);
  });
  document.addEventListener('mouseout', function (event) {
    if (event.target.closest('.prose a[href^="#"]')) { clearTimeout(previewTimer); preview.hidden = true; }
  });

  /* ---------- diagram zoom ---------- */
  var zoom = document.querySelector('.zoom');
  var stage = zoom && zoom.querySelector('.zoom-stage > div');
  var scale = 1;
  function setScale(next) { scale = Math.min(6, Math.max(0.25, next)); stage.style.transform = 'scale(' + scale + ')'; }
  function closeZoom() { zoom.classList.remove('open'); stage.innerHTML = ''; }
  if (zoom && stage) {
    document.addEventListener('click', function (event) {
      var fig = event.target.closest('figure.diagram');
      if (!fig || event.target.closest('a')) return;
      var svg = fig.querySelector('svg, img');
      if (!svg) return;
      stage.innerHTML = '';
      stage.appendChild(svg.cloneNode(true));
      zoom.classList.add('open');
      var box = zoom.querySelector('.zoom-stage');
      var natural = stage.firstChild.getBoundingClientRect().width || 1;
      setScale(Math.min(3, (box.clientWidth - 48) / natural));
    });
    zoom.querySelector('[data-zoom="in"]').addEventListener('click', function () { setScale(scale * 1.25); });
    zoom.querySelector('[data-zoom="out"]').addEventListener('click', function () { setScale(scale / 1.25); });
    zoom.querySelector('[data-zoom="close"]').addEventListener('click', closeZoom);
    zoom.addEventListener('click', function (event) { if (event.target === zoom) closeZoom(); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && zoom.classList.contains('open')) closeZoom(); });
  }

  /* ---------- theme and mobile nav ---------- */
  var saved = store('book-export-theme');
  if (saved) doc.setAttribute('data-theme', saved);
  var themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var dark = doc.getAttribute('data-theme') ? doc.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    store('book-export-theme', next);
  });
  var navBtn = document.querySelector('.nav-toggle');
  if (navBtn) navBtn.addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
})();
`;
