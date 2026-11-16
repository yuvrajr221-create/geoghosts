import { HttpError } from './util.js';
import { THEME_IDS } from './themes.js';

const RESERVED = new Set(['admin', 'api', 'u', 'ring', 'static', 'about', 'login', 'register', 'root', 'support', 'geoghosts']);

function text(value, field, { max, min = 0, multiline = false }) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`);
  let v = value.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (!multiline) v = v.replace(/\n/g, ' ');
  v = v.trim();
  if (v.length < min) throw new HttpError(400, `${field} is required`);
  if (v.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return v;
}

export function validateCredentials(body) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    throw new HttpError(400, 'Username must be 3-20 characters: letters, numbers or underscores');
  }
  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Password must be 8-128 characters');
  }
  return { username, password };
}

export function assertUsernameAllowed(username) {
  if (RESERVED.has(username.toLowerCase())) throw new HttpError(400, 'That username is reserved');
}

export function validatePage(body) {
  const theme = body.theme;
  if (!THEME_IDS.includes(theme)) throw new HttpError(400, 'Unknown theme');
  const rawLinks = body.links ?? [];
  if (!Array.isArray(rawLinks) || rawLinks.length > 8) throw new HttpError(400, 'You can add up to 8 links');
  const links = rawLinks.map((l, i) => {
    if (!l || typeof l !== 'object') throw new HttpError(400, `Link ${i + 1} is invalid`);
    const label = text(l.label, `Link ${i + 1} label`, { min: 1, max: 40 });
    const raw = text(l.url, `Link ${i + 1} URL`, { min: 1, max: 300 });
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new HttpError(400, `Link ${i + 1} URL is not valid`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new HttpError(400, `Link ${i + 1} must start with http:// or https://`);
    }
    return { label, url: url.href };
  });
  return {
    title: text(body.title, 'Title', { min: 1, max: 60 }),
    tagline: text(body.tagline, 'Tagline', { max: 120 }),
    bio: text(body.bio, 'Bio', { max: 1000, multiline: true }),
    marquee: text(body.marquee, 'Marquee', { max: 140 }),
    theme,
    links,
  };
}

export function validateGuestbook(body) {
  return {
    author: text(body.author, 'Name', { min: 1, max: 30 }),
    message: text(body.message, 'Message', { min: 1, max: 300 }),
  };
}
