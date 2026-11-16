# Design: GeoGhosts core

## Architecture
Single Node.js process: `node:http` router -> handlers -> prepared SQLite statements. Static SPA served from `public/`.
Profile pages are rendered on the server for SEO, speed and graceful degradation.

## Data model
- `users(id, username UNIQUE NOCASE, pass_hash, created_at)`
- `pages(user_id PK/FK, title, tagline, bio, theme, marquee, links JSON, visits, updated_at)`
- `guestbook(id, page_user_id FK, author, message, created_at)`; index on `(page_user_id, id DESC)`

## API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/register, /api/login, /api/logout | - | session management |
| GET | /api/me | optional | current user and page |
| PUT | /api/me/page | yes | edit page |
| POST | /api/generate | yes | Séance copy |
| GET | /api/pages, /api/pages/:username | - | directory, page + guestbook |
| POST | /api/pages/:username/guestbook | - | sign guestbook |
| DELETE | /api/guestbook/:id | owner | remove entry |
| GET | /ring/:username/(next\|prev\|random) | - | 302 to another page |
| GET | /u/:username | - | server-rendered page |

## Security decisions
- scrypt hashing; HMAC-signed session cookie; SameSite=Lax plus JSON-only mutations plus Origin check.
- Strict CSP (no inline scripts); all user content escaped in `render.js`; DOM built with `textContent` in the SPA.
- Per-IP rate limits for auth, guestbook and AI generation.

## Testing strategy
Integration tests start the real server on an ephemeral port with an in-memory database (`tests/app.test.js`).
