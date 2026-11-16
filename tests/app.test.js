import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

let app;
let base;

before(async () => {
  app = createApp({ dbPath: ':memory:', secret: 'test-secret', apiKey: undefined });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await app.close();
});

async function call(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html or empty */
  }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, json, text, headers: res.headers, cookie: setCookie ? setCookie.split(';')[0] : null };
}

const validPage = (over = {}) => ({
  title: 'Spooky Place',
  tagline: 'Boo',
  bio: 'Line one\nLine two',
  marquee: '~*~ hi ~*~',
  theme: 'neon-void',
  links: [{ label: 'Example', url: 'https://example.com/a' }],
  ...over,
});

test('health endpoint and security headers', async () => {
  const r = await call('/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('registration validates input and rejects reserved or duplicate names', async () => {
  assert.equal((await call('/api/register', { method: 'POST', body: { username: 'a', password: 'longenough1' } })).status, 400);
  assert.equal((await call('/api/register', { method: 'POST', body: { username: 'valid_name', password: 'short' } })).status, 400);
  assert.equal((await call('/api/register', { method: 'POST', body: { username: 'admin', password: 'longenough1' } })).status, 400);
  const ok = await call('/api/register', { method: 'POST', body: { username: 'Casper', password: 'longenough1' } });
  assert.equal(ok.status, 201);
  assert.ok(ok.cookie?.startsWith('gg_session='));
  const dup = await call('/api/register', { method: 'POST', body: { username: 'casper', password: 'longenough1' } });
  assert.equal(dup.status, 409);
});

test('mutating requests must be JSON', async () => {
  const res = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
  assert.equal(res.status, 415);
  const cross = await call('/api/logout', { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
});

test('login, session and logout', async () => {
  await call('/api/register', { method: 'POST', body: { username: 'login_user', password: 'longenough1' } });
  assert.equal((await call('/api/login', { method: 'POST', body: { username: 'login_user', password: 'wrongpass12' } })).status, 401);
  assert.equal((await call('/api/login', { method: 'POST', body: { username: 'nobody_here', password: 'wrongpass12' } })).status, 401);
  const login = await call('/api/login', { method: 'POST', body: { username: 'login_user', password: 'longenough1' } });
  assert.equal(login.status, 200);
  const me = await call('/api/me', { cookie: login.cookie });
  assert.equal(me.json.user.username, 'login_user');
  assert.equal((await call('/api/me')).json.user, null);
  const tampered = await call('/api/me', { cookie: login.cookie.slice(0, -2) + 'xx' });
  assert.equal(tampered.json.user, null);
});

test('editing a page requires auth, validates and persists', async () => {
  assert.equal((await call('/api/me/page', { method: 'PUT', body: validPage() })).status, 401);
  const reg = await call('/api/register', { method: 'POST', body: { username: 'editor_1', password: 'longenough1' } });
  const bad = await call('/api/me/page', { method: 'PUT', cookie: reg.cookie, body: validPage({ theme: 'nope' }) });
  assert.equal(bad.status, 400);
  const badLink = await call('/api/me/page', {
    method: 'PUT', cookie: reg.cookie, body: validPage({ links: [{ label: 'x', url: 'javascript:alert(1)' }] }),
  });
  assert.equal(badLink.status, 400);
  const ok = await call('/api/me/page', { method: 'PUT', cookie: reg.cookie, body: validPage() });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.page.theme, 'neon-void');
  const pub = await call('/api/pages/editor_1');
  assert.equal(pub.json.page.title, 'Spooky Place');
  assert.equal(pub.json.page.links[0].url, 'https://example.com/a');
});

test('profile pages escape user content (XSS)', async () => {
  const reg = await call('/api/register', { method: 'POST', body: { username: 'xss_victim', password: 'longenough1' } });
  const payload = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  await call('/api/me/page', { method: 'PUT', cookie: reg.cookie, body: validPage({ bio: payload, title: payload.slice(0, 40) }) });
  await call('/api/pages/xss_victim/guestbook', { method: 'POST', body: { author: '<b>mallory</b>', message: payload.slice(0, 120) } });
  const page = await call('/u/xss_victim');
  assert.equal(page.status, 200);
  assert.ok(!page.text.includes('<script>alert(1)</script>'));
  assert.ok(!page.text.includes('<img src=x'));
  assert.ok(page.text.includes('&lt;script&gt;'));
  assert.ok(page.text.includes('&lt;b&gt;mallory&lt;/b&gt;'));
});

test('guestbook: sign, validate, owner-only delete', async () => {
  const owner = await call('/api/register', { method: 'POST', body: { username: 'gb_owner', password: 'longenough1' } });
  const other = await call('/api/register', { method: 'POST', body: { username: 'gb_other', password: 'longenough1' } });
  assert.equal((await call('/api/pages/gb_owner/guestbook', { method: 'POST', body: { author: '', message: 'hi' } })).status, 400);
  assert.equal((await call('/api/pages/nobody_x/guestbook', { method: 'POST', body: { author: 'a', message: 'hi' } })).status, 404);
  const signed = await call('/api/pages/gb_owner/guestbook', { method: 'POST', body: { author: 'Bob', message: 'Hello ghost' } });
  assert.equal(signed.status, 201);
  const id = signed.json.id;
  assert.equal((await call(`/api/guestbook/${id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await call(`/api/guestbook/${id}`, { method: 'DELETE', cookie: other.cookie })).status, 403);
  assert.equal((await call(`/api/guestbook/${id}`, { method: 'DELETE', cookie: owner.cookie })).status, 200);
  assert.equal((await call('/api/pages/gb_owner')).json.entries.length, 0);
});

test('guestbook is rate limited per IP', async () => {
  await call('/api/register', { method: 'POST', body: { username: 'rate_target', password: 'longenough1' } });
  const statuses = [];
  for (let i = 0; i < 10; i++) {
    statuses.push((await call('/api/pages/rate_target/guestbook', { method: 'POST', body: { author: 'a', message: `m${i}` } })).status);
  }
  assert.ok(statuses.includes(429));
});

test('visitor counter counts each visitor once per cookie and ignores the owner', async () => {
  const owner = await call('/api/register', { method: 'POST', body: { username: 'counted', password: 'longenough1' } });
  const first = await call('/u/counted');
  assert.equal((await call('/api/pages/counted')).json.page.visits, 1);
  await call('/u/counted', { cookie: first.cookie });
  assert.equal((await call('/api/pages/counted')).json.page.visits, 1);
  await call('/u/counted', { cookie: owner.cookie });
  assert.equal((await call('/api/pages/counted')).json.page.visits, 1);
  await call('/u/counted');
  assert.equal((await call('/api/pages/counted')).json.page.visits, 2);
});

test('webring wraps around and never 500s', async () => {
  const a = await call('/ring/casper/next');
  assert.equal(a.status, 302);
  assert.match(a.headers.get('location'), /^\/u\/[A-Za-z0-9_]+$/);
  const prev = await call('/ring/casper/prev');
  assert.equal(prev.status, 302);
  assert.equal((await call('/ring/casper/random')).status, 302);
  assert.equal((await call('/ring/ghost_nobody/next')).status, 404);
});

test('directory search escapes wildcards', async () => {
  const all = await call('/api/pages');
  assert.ok(all.json.pages.length > 3);
  const none = await call('/api/pages?q=' + encodeURIComponent('%'));
  assert.equal(none.json.pages.length, 0);
  const some = await call('/api/pages?q=casper');
  assert.ok(some.json.pages.some((p) => p.username === 'Casper'));
});

test('AI generator requires login and falls back to templates without an API key', async () => {
  assert.equal((await call('/api/generate', { method: 'POST', body: { interests: 'x' } })).status, 401);
  const reg = await call('/api/register', { method: 'POST', body: { username: 'seance_1', password: 'longenough1' } });
  assert.equal((await call('/api/generate', { method: 'POST', cookie: reg.cookie, body: { interests: '  ' } })).status, 400);
  const r = await call('/api/generate', { method: 'POST', cookie: reg.cookie, body: { interests: 'retro games, synthwave' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.source, 'template');
  assert.ok(r.json.tagline.length > 0 && r.json.bio.length > 0);
});

test('static files and 404s; path traversal is blocked', async () => {
  assert.equal((await call('/')).status, 200);
  const nf = await call('/does-not-exist');
  assert.equal(nf.status, 404);
  assert.match(nf.text, /404/);
  assert.equal((await call('/api/nope')).status, 404);
  const trav = await call('/..%2f..%2fpackage.json');
  assert.equal(trav.status, 404);
  assert.equal((await call('/u/nobody_such_user')).status, 404);
});
