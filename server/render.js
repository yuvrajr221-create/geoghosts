import { escapeHtml as e } from './util.js';
import { THEMES, DEFAULT_THEME } from './themes.js';

const THEME_DEFAULT = THEMES[DEFAULT_THEME];

const fmtDate = (ts) => new Date(ts).toISOString().slice(0, 10);

function multiline(text) {
  return e(text).replace(/\n/g, '<br>');
}

const themeOf = (page) => THEMES[page.theme] ?? THEME_DEFAULT;

/** CSS custom properties and background for the chosen theme (values come from themes.js, not users). */
function themeStyle(theme) {
  return `:root{--bg:${theme.bg};--panel:${theme.panel};--text:${theme.text};--muted:${theme.muted};--accent:${theme.accent};--accent2:${theme.accent2};--font:${theme.font}}
body{background-color:var(--bg);background-image:${theme.pattern};background-size:${theme.size}}`;
}

function heroHtml(page) {
  return `<header class="hero">
  <h1>${e(page.title)}</h1>
  ${page.tagline ? `<p class="tagline">${e(page.tagline)}</p>` : ''}
</header>
${page.marquee ? `<div class="marquee" aria-label="Scrolling message"><span>${e(page.marquee)}</span></div>` : ''}`;
}

function bioHtml(page) {
  return `<section class="card">
    <h2>About me</h2>
    <p class="bio">${page.bio ? multiline(page.bio) : '<span class="muted">This ghost has not written a bio yet.</span>'}</p>
  </section>`;
}

function counterHtml(page, label = 'Visitor counter') {
  const visits = Number(page.visits);
  const digits = String(visits).padStart(6, '0').split('');
  return `<aside class="card">
    <h2>${label}</h2>
    <div class="counter" role="img" aria-label="${visits} visitors">${digits.map((d) => `<span>${d}</span>`).join('')}</div>
    <p class="muted">You are visitor #${visits}</p>
  </aside>`;
}

function linksHtml(links) {
  if (!links.length) return '';
  return `<section class="card">
        <h2>Cursed links</h2>
        <ul class="links">${links
          .map(
            (l) =>
              `<li><a href="${e(l.url)}" target="_blank" rel="noopener noreferrer nofollow ugc">${e(l.label)}</a></li>`,
          )
          .join('')}</ul></section>`;
}

function entriesHtml(entries, { isOwner = false } = {}) {
  if (!entries.length) return '<li class="empty">No signatures yet. Be the first ghost to sign!</li>';
  return entries
    .map(
      (en) => `<li data-id="${en.id}">
        <div class="gb-head"><strong>${e(en.author)}</strong>
          <time datetime="${fmtDate(en.created_at)}">${fmtDate(en.created_at)}</time>
          ${isOwner ? `<button type="button" class="gb-delete" data-delete="${en.id}" aria-label="Delete this entry">Delete</button>` : ''}
        </div>
        <p>${e(en.message)}</p></li>`,
    )
    .join('');
}

const descriptionOf = (owner, page) => e(page.tagline || `${owner.username}'s haunted homepage on GeoGhosts`);

export function renderProfile({ owner, page, entries, isOwner }) {
  const theme = themeOf(page);
  const u = e(owner.username);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(page.title)} · GeoGhosts</title>
<meta name="description" content="${descriptionOf(owner, page)}">
<meta property="og:title" content="${e(page.title)}">
<meta property="og:description" content="${e(page.tagline)}">
<meta name="theme-color" content="${theme.bg}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/profile.css">
<style>
${themeStyle(theme)}
</style>
</head>
<body data-username="${u}">
<div class="construct" role="note">🚧 This page is under eternal construction 🚧</div>
${heroHtml(page)}
<main class="grid">
  ${bioHtml(page)}
  ${counterHtml(page)}
  ${linksHtml(page.links)}
  <section class="card wide">
    <h2>Guestbook</h2>
    <form id="gb-form" autocomplete="off">
      <label>Your name <input name="author" maxlength="30" required></label>
      <label>Message <textarea name="message" maxlength="300" rows="3" required></textarea></label>
      <div class="row"><button type="submit">Sign the guestbook</button><span id="gb-error" class="error" role="alert"></span></div>
    </form>
    <ul id="gb-list" class="gb-list">${entriesHtml(entries, { isOwner })}</ul>
  </section>
</main>
<nav class="ring" aria-label="GeoGhosts webring">
  <a href="/ring/${u}/prev">← Previous ghost</a>
  <a href="/ring/${u}/random">👻 Random</a>
  <a href="/ring/${u}/next">Next ghost →</a>
</nav>
<footer class="foot">
  <p>Haunting the web with <a href="/">GeoGhosts</a> · <a href="/#/register">Make your own page</a></p>
  <p class="muted">Best viewed in Netscape Navigator 4.0 at 800×600</p>
</footer>
<script src="/profile.js" defer></script>
</body>
</html>`;
}

/**
 * Self-contained copy of a page for download: inlined CSS, no scripts, no forms, no links back to the live site.
 * `css` is the contents of public/profile.css (trusted, read from disk by the server).
 */
export function renderExport({ owner, page, entries, css, exportedAt }) {
  const theme = themeOf(page);
  const exported = fmtDate(exportedAt);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${e(page.title)}</title>
<meta name="description" content="${descriptionOf(owner, page)}">
<meta name="theme-color" content="${theme.bg}">
<style>
${css}
${themeStyle(theme)}
</style>
</head>
<body>
${heroHtml(page)}
<main class="grid">
  ${bioHtml(page)}
  ${counterHtml(page, 'Visitor counter (snapshot)')}
  ${linksHtml(page.links)}
  <section class="card wide">
    <h2>Guestbook</h2>
    <ul class="gb-list">${entriesHtml(entries)}</ul>
  </section>
</main>
<footer class="foot">
  <p class="muted">A ghost from GeoGhosts, exported on ${exported}.</p>
</footer>
</body>
</html>`;
}

export function renderNotFound(message = 'This page has vanished into the void.') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · GeoGhosts</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"></head>
<body><main class="notfound"><img src="/favicon.svg" alt="" width="72" height="72"><h1>404</h1><p>${e(message)}</p><p><a class="btn" href="/">Back to GeoGhosts</a></p></main></body></html>`;
}
