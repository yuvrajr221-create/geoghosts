# 👻 GeoGhosts

**Resurrect the personal web.** GeoGhosts revives GeoCities-style home pages (guestbooks, visitor counters,
webrings and scrolling marquees) with a haunted theme and a secure, modern backend.
Built for the **Kiroween 2026** hackathon, category **Resurrection**.

## Features
- 🏚️ One public page per user at `/u/<username>`, server-rendered (fast, SEO-friendly, works without JS)
- 📖 Guestbook (owner moderation, per-IP rate limiting) and 🔢 honest visitor counter (once per visitor per day, owner excluded)
- 🕸️ Webring navigation (previous / next / random) and a searchable directory of pages
- 🎨 Four themes: Haunted Mansion, Neon Void, Vapor Cemetery, Pumpkin Patch
- ✍️ Dashboard with live preview, link manager and the 🔮 Séance copywriter (uses Claude when `ANTHROPIC_API_KEY` is set, otherwise a built-in template generator)
- 🔒 Security-first: scrypt password hashing, signed HttpOnly sessions, strict CSP, output escaping, input validation, rate limits

## Tech stack
Node.js 22+ with **zero npm dependencies**: `node:http`, `node:sqlite`, `node:crypto`, `node:test`.
Vanilla JavaScript front end (no build step). SQLite storage.

## Run locally
Requires Node.js **22.13 or newer** (`node -v`).

```bash
git clone <your-repo-url> && cd geoghosts
export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npm start            # http://localhost:3000
npm test             # integration tests
```

## Configuration
See [`.env.example`](.env.example). Key variables: `PORT`, `SESSION_SECRET`, `COOKIE_SECURE=1` (when served over HTTPS),
`TRUST_PROXY=1` (behind a proxy), `DB_PATH`, optional `ANTHROPIC_API_KEY`.

## Deploy
```bash
docker build -t geoghosts .
docker run -d -p 80:3000 -v geoghosts-data:/data \
  -e SESSION_SECRET=<long-random-string> geoghosts
```
Put it behind HTTPS (for example a load balancer or Caddy) and set `COOKIE_SECURE=1` and `TRUST_PROXY=1`.

## API overview
| Method | Path | Notes |
|---|---|---|
| POST | `/api/register`, `/api/login`, `/api/logout` | session cookie |
| GET / PUT | `/api/me`, `/api/me/page` | current user, edit page |
| POST | `/api/generate` | Séance copy (auth, rate-limited) |
| GET | `/api/pages`, `/api/pages/:username` | directory, page + guestbook |
| POST | `/api/pages/:username/guestbook` | sign guestbook |
| DELETE | `/api/guestbook/:id` | owner only |
| GET | `/ring/:username/(next\|prev\|random)` | webring redirect |

## How Kiro was used
> Fill this section honestly with what you actually did in Kiro (specs, steering, hooks, MCP, powers, PBT),
> what worked, and what you would change. Judges read it.

The `.kiro/` directory contains the steering documents and specs for this project.

## License
[MIT](LICENSE)
