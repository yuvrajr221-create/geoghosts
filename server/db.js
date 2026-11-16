import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path = './data/geoghosts.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pass_hash  TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pages (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      tagline    TEXT NOT NULL DEFAULT '',
      bio        TEXT NOT NULL DEFAULT '',
      theme      TEXT NOT NULL DEFAULT 'haunted-mansion',
      marquee    TEXT NOT NULL DEFAULT '',
      links      TEXT NOT NULL DEFAULT '[]',
      visits     INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guestbook (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      page_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author       TEXT NOT NULL,
      message      TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_guestbook_page ON guestbook(page_user_id, id DESC);
  `);
  return db;
}
