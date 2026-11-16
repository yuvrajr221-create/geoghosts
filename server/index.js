import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

import { openDb } from './db.js';
import { HttpError, parseCookies, rateLimiter, readJson } from './util.js';
import { DUMMY_HASH, SESSION_TTL_SECONDS, createSession, hashPassword, readSession, verifyPassword } from './auth.js';
import { DEFAULT_THEME, THEMES, THEME_IDS } from './themes.js';
import { assertUsernameAllowed, validateCredentials, validateGuestbook, validatePage } from './validate.js';
import { renderNotFound, renderProfile } from './render.js';
import { generateCopy } from './ai.js';
import { buildExport } from './export.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC_DIR = join(ROOT, 'public');
const PROFILE_CSS = readFileSync(join(PUBLIC_DIR, 'profile.css'), 'utf8');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function createApp(options = {}) {
  const {
    dbPath = process.env.DB_PATH || './data/geoghosts.db',
    production = process.env.NODE_ENV === 'production',
    secureCookies = process.env.COOKIE_SECURE === '1',
    trustProxy = process.env.TRUST_PROXY === '1',
    apiKey = process.env.ANTHROPIC_API_KEY,
    model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  } = options;
  let secret = options.secret ?? process.env.SESSION_SECRET;
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    console.warn('SESSION_SECRET is not set: using a random secret, so sessions reset on restart.');
  }

  const db = openDb(dbPath);
  const sql = {
    userByName: db.prepare('SELECT id, username FROM users WHERE username = ?'),
    userById: db.prepare('SELECT id, username FROM users WHERE id = ?'),
    userAuth: db.prepare('SELECT id, username, pass_hash FROM users WHERE username = ?'),
    insertUser: db.prepare('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?)'),
    insertPage: db.prepare(
      'INSERT INTO pages (user_id, title, tagline, bio, theme, marquee, links, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    page: db.prepare('SELECT * FROM pages WHERE user_id = ?'),
    updatePage: db.prepare(
      'UPDATE pages SET title = ?, tagline = ?, bio = ?, theme = ?, marquee = ?, links = ?, updated_at = ? WHERE user_id = ?',
    ),
    bumpVisits: db.prepare('UPDATE pages SET visits = visits + 1 WHERE user_id = ?'),
    directory: db.prepare(
      `SELECT u.username, p.title, p.tagline, p.theme, p.visits
         FROM pages p JOIN users u ON u.id = p.user_id
        WHERE u.username LIKE ?1 ESCAPE '\\' OR p.title LIKE ?1 ESCAPE '\\'
        ORDER BY p.visits DESC, p.updated_at DESC LIMIT 24`,
    ),
    entries: db.prepare(
      'SELECT id, author, message, created_at FROM guestbook WHERE page_user_id = ? ORDER BY id DESC LIMIT 50',
    ),
    allEntries: db.prepare(
      'SELECT id, author, message, created_at FROM guestbook WHERE page_user_id = ? ORDER BY id DESC LIMIT 1000',
    ),
    insertEntry: db.prepare('INSERT INTO guestbook (page_user_id, author, message, created_at) VALUES (?, ?, ?, ?)'),
    entryById: db.prepare('SELECT id, page_user_id FROM guestbook WHERE id = ?'),
    deleteEntry: db.prepare('DELETE FROM guestbook WHERE id = ?'),
    ringNext: db.prepare('SELECT username FROM users WHERE id > ? ORDER BY id LIMIT 1'),
    ringFirst: db.prepare('SELECT username FROM users ORDER BY id LIMIT 1'),
    ringPrev: db.prepare('SELECT username FROM users WHERE id < ? ORDER BY id DESC LIMIT 1'),
    ringLast: db.prepare('SELECT username FROM users ORDER BY id DESC LIMIT 1'),
    ringRandom: db.prepare('SELECT username FROM users WHERE id != ? ORDER BY RANDOM() LIMIT 1'),
  };

  const authLimit = rateLimiter({ windowMs: 15 * 60_000, max: 20 });
  const guestbookLimit = rateLimiter({ windowMs: 10 * 60_000, max: 6 });
  const generateLimit = rateLimiter({ windowMs: 60_000, max: 5 });
  const exportLimit = rateLimiter({ windowMs: 10 * 60_000, max: 5 });

  const toPage = (owner, row) => ({
    username: owner.username,
    title: row.title,
    tagline: row.tagline,
    bio: row.bio,
    theme: row.theme,
    marquee: row.marquee,
    links: JSON.parse(row.links),
    visits: row.visits,
    updatedAt: row.updated_at,
  });

  const clientIp = (req) => {
    if (trustProxy) {
      const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
      if (fwd) return fwd;
    }
    return req.socket.remoteAddress ?? 'unknown';
  };

  const sessionCookie = (value, maxAge) =>
    `gg_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;

  function send(res, status, body, headers = {}) {
    res.writeHead(status, headers);
    res.end(body);
  }
  function sendJson(res, status, data, headers = {}) {
    send(res, status, JSON.stringify(data), {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    });
  }

  // ---- routing -------------------------------------------------------------
  const routes = [];
  const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

  route('GET', /^\/api\/health$/, ({ res }) => sendJson(res, 200, { ok: true }));

  route('GET', /^\/api\/themes$/, ({ res }) =>
    sendJson(res, 200, {
      themes: THEME_IDS.map((id) => ({
        id,
        label: THEMES[id].label,
        colors: [THEMES[id].bg, THEMES[id].accent, THEMES[id].accent2],
      })),
    }),
  );

  route('POST', /^\/api\/register$/, async ({ req, res, ip }) => {
    if (!authLimit(`auth:${ip}`)) throw new HttpError(429, 'Too many attempts. Try again later.');
    const { username, password } = validateCredentials(await readJson(req));
    assertUsernameAllowed(username);
    const now = Date.now();
    let userId;
    db.exec('BEGIN');
    try {
      userId = Number(sql.insertUser.run(username, hashPassword(password), now).lastInsertRowid);
      sql.insertPage.run(
        userId,
        `${username}'s Haunted Homepage`,
        'Welcome, mortal. Sign my guestbook.',
        'I am a ghost of the old web. Edit this bio from your dashboard to tell visitors who you are.',
        DEFAULT_THEME,
        `~*~ Welcome to ${username}'s haunted corner of the web ~*~`,
        '[]',
        now,
      );
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      if (String(err.message).includes('UNIQUE')) throw new HttpError(409, 'That username is already taken');
      throw err;
    }
    sendJson(res, 201, { user: { id: userId, username } }, {
      'set-cookie': sessionCookie(createSession(userId, secret), SESSION_TTL_SECONDS),
    });
  });

  route('POST', /^\/api\/login$/, async ({ req, res, ip }) => {
    if (!authLimit(`auth:${ip}`)) throw new HttpError(429, 'Too many attempts. Try again later.');
    const body = await readJson(req);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
    const row = sql.userAuth.get(username);
    const ok = verifyPassword(password, row ? row.pass_hash : DUMMY_HASH);
    if (!row || !ok) throw new HttpError(401, 'Wrong username or password');
    sendJson(res, 200, { user: { id: row.id, username: row.username } }, {
      'set-cookie': sessionCookie(createSession(row.id, secret), SESSION_TTL_SECONDS),
    });
  });

  route('POST', /^\/api\/logout$/, ({ res }) => sendJson(res, 200, { ok: true }, { 'set-cookie': sessionCookie('', 0) }));

  route('GET', /^\/api\/me$/, ({ res, user }) => {
    if (!user) return sendJson(res, 200, { user: null, page: null });
    sendJson(res, 200, { user, page: toPage(user, sql.page.get(user.id)) });
  });

  route('PUT', /^\/api\/me\/page$/, async ({ req, res, user }) => {
    if (!user) throw new HttpError(401, 'Please log in first');
    const p = validatePage(await readJson(req));
    sql.updatePage.run(p.title, p.tagline, p.bio, p.theme, p.marquee, JSON.stringify(p.links), Date.now(), user.id);
    sendJson(res, 200, { page: toPage(user, sql.page.get(user.id)) });
  });

  route('GET', /^\/api\/me\/export$/, ({ res, user }) => {
    if (!user) throw new HttpError(401, 'Please log in first');
    if (!exportLimit(`export:${user.id}`)) throw new HttpError(429, 'Too many exports. Try again in a few minutes.');
    const row = sql.page.get(user.id);
    const zip = buildExport({
      owner: user,
      page: { ...row, links: JSON.parse(row.links) },
      entries: sql.allEntries.all(user.id),
      css: PROFILE_CSS,
    });
    send(res, 200, zip, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="geoghosts-${user.username}.zip"`,
      'content-length': zip.length,
      'cache-control': 'no-store',
    });
  });

  route('POST', /^\/api\/generate$/, async ({ req, res, user, ip }) => {
    if (!user) throw new HttpError(401, 'Please log in first');
    if (!generateLimit(`gen:${user.id}:${ip}`)) throw new HttpError(429, 'Slow down: try again in a minute');
    const body = await readJson(req);
    const interests = typeof body.interests === 'string' ? body.interests.trim().slice(0, 200) : '';
    if (!interests) throw new HttpError(400, 'Tell the séance what you are into first');
    const copy = await generateCopy({ name: user.username, interests }, { apiKey, model });
    sendJson(res, 200, copy);
  });

  route('GET', /^\/api\/pages$/, ({ res, url }) => {
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 40).replace(/[\\%_]/g, (c) => `\\${c}`);
    sendJson(res, 200, { pages: sql.directory.all(`%${q}%`).map((r) => ({ ...r })) });
  });

  route('GET', /^\/api\/pages\/(?<username>[A-Za-z0-9_]{3,20})$/, ({ res, params }) => {
    const owner = sql.userByName.get(params.username);
    if (!owner) throw new HttpError(404, 'No such page');
    sendJson(res, 200, { page: toPage(owner, sql.page.get(owner.id)), entries: sql.entries.all(owner.id).map((r) => ({ ...r })) });
  });

  route('POST', /^\/api\/pages\/(?<username>[A-Za-z0-9_]{3,20})\/guestbook$/, async ({ req, res, params, ip }) => {
    const owner = sql.userByName.get(params.username);
    if (!owner) throw new HttpError(404, 'No such page');
    if (!guestbookLimit(`gb:${ip}`)) throw new HttpError(429, 'You are signing too fast. Please wait a bit.');
    const { author, message } = validateGuestbook(await readJson(req));
    const info = sql.insertEntry.run(owner.id, author, message, Date.now());
    sendJson(res, 201, { id: Number(info.lastInsertRowid) });
  });

  route('DELETE', /^\/api\/guestbook\/(?<id>\d{1,12})$/, ({ res, params, user }) => {
    if (!user) throw new HttpError(401, 'Please log in first');
    const entry = sql.entryById.get(Number(params.id));
    if (!entry) throw new HttpError(404, 'No such entry');
    if (entry.page_user_id !== user.id) throw new HttpError(403, 'You can only delete entries on your own page');
    sql.deleteEntry.run(entry.id);
    sendJson(res, 200, { ok: true });
  });

  route('GET', /^\/ring\/(?<username>[A-Za-z0-9_]{3,20})\/(?<dir>next|prev|random)$/, ({ res, params }) => {
    const current = sql.userByName.get(params.username);
    if (!current) throw new HttpError(404, 'No such page');
    let target;
    if (params.dir === 'next') target = sql.ringNext.get(current.id) ?? sql.ringFirst.get();
    else if (params.dir === 'prev') target = sql.ringPrev.get(current.id) ?? sql.ringLast.get();
    else target = sql.ringRandom.get(current.id) ?? current;
    send(res, 302, '', { location: `/u/${target.username}`, 'cache-control': 'no-store' });
  });

  route('GET', /^\/u\/(?<username>[A-Za-z0-9_]{3,20})\/?$/, ({ req, res, params, user }) => {
    const owner = sql.userByName.get(params.username);
    if (!owner) throw new HttpError(404, 'This ghost does not exist (yet).');
    const isOwner = user?.id === owner.id;
    const cookieName = `gg_v_${owner.id}`;
    const headers = {};
    if (!isOwner && !parseCookies(req.headers.cookie)[cookieName]) {
      sql.bumpVisits.run(owner.id);
      headers['set-cookie'] = `${cookieName}=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secureCookies ? '; Secure' : ''}`;
    }
    const row = sql.page.get(owner.id);
    const html = renderProfile({
      owner,
      page: { ...row, links: JSON.parse(row.links) },
      entries: sql.entries.all(owner.id),
      isOwner,
    });
    send(res, 200, html, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers });
  });

  // ---- static files --------------------------------------------------------
  async function serveStatic(pathname, req, res) {
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      throw new HttpError(400, 'Bad path');
    }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = resolve(PUBLIC_DIR, `.${rel}`);
    if (!file.startsWith(PUBLIC_DIR + sep)) throw new HttpError(404, 'Not found');
    let info;
    try {
      info = await stat(file);
    } catch {
      throw new HttpError(404, 'Not found');
    }
    if (!info.isFile()) throw new HttpError(404, 'Not found');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'content-length': body.length,
      'cache-control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=300',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  // ---- server --------------------------------------------------------------
  function securityHeaders(res) {
    res.setHeader(
      'content-security-policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
        "connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'",
    );
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    res.setHeader('x-frame-options', 'SAMEORIGIN');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (production && secureCookies) res.setHeader('strict-transport-security', 'max-age=15552000');
  }

  function handleError(err, req, res, pathname) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    const message = status === 500 ? 'Something went wrong on our side' : err.message;
    if (res.headersSent) return res.end();
    const wantsHtml = req.method === 'GET' && !pathname.startsWith('/api/') && status === 404;
    if (wantsHtml) return send(res, 404, renderNotFound(message), { 'content-type': 'text/html; charset=utf-8' });
    sendJson(res, status, { error: message });
  }

  const server = http.createServer(async (req, res) => {
    securityHeaders(res);
    let pathname = '/';
    try {
      let url;
      try {
        url = new URL(req.url, 'http://localhost');
      } catch {
        throw new HttpError(400, 'Bad request');
      }
      pathname = url.pathname;

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const origin = req.headers.origin;
        if (origin) {
          let host = '';
          try {
            host = new URL(origin).host;
          } catch {
            /* handled below */
          }
          if (host !== req.headers.host) throw new HttpError(403, 'Cross-origin requests are not allowed');
        }
      }

      const userId = readSession(parseCookies(req.headers.cookie).gg_session, secret);
      const user = userId ? sql.userById.get(userId) : null;
      const ctx = { req, res, url, user: user ? { ...user } : null, ip: clientIp(req), params: {} };

      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.pattern.exec(pathname);
        if (m) {
          ctx.params = m.groups ?? {};
          return await r.handler(ctx);
        }
      }
      if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(pathname, req, res);
      throw new HttpError(404, 'Not found');
    } catch (err) {
      handleError(err, req, res, pathname);
    }
  });

  return {
    server,
    db,
    close() {
      return new Promise((done) => {
        server.close(() => {
          db.close();
          done();
        });
        server.closeAllConnections?.();
      });
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  app.server.listen(port, process.env.HOST || '0.0.0.0', () => {
    console.log(`GeoGhosts is haunting http://localhost:${port}`);
  });
  const shutdown = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
