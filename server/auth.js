import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

// Used to keep login timing similar whether or not the username exists.
export const DUMMY_HASH = hashPassword('not-a-real-password');

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export function createSession(userId, secret, ttl = SESSION_TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user id from a signed session cookie value, or null. */
export function readSession(value, secret) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(`${id}.${exp}`, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const userId = Number(id);
  return Number.isInteger(userId) ? userId : null;
}
