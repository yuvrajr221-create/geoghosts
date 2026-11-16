export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}

/** Sliding-window rate limiter. Returns a function: allow(key) -> boolean. */
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
    return true;
  };
}

export async function readJson(req, limit = 20_000) {
  const type = (req.headers['content-type'] ?? '').toLowerCase();
  if (!type.startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    return value;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
