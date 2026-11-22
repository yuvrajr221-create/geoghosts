# 👻 GeoGhosts

**Resurrect the personal web.** GeoGhosts revives GeoCities-style home pages (guestbooks, visitor counters,
webrings and scrolling marquees) with a haunted theme and a secure, modern backend.
Built for the **Kiroween 2026** hackathon, category **Resurrection**.

## Live demo

https://35-153-171-109.sslip.io

Anyone can register a page, no credentials needed. Hosted on one AWS EC2 instance behind Caddy (HTTPS).

## How Kiro was used

The base app (pages, guestbook, visitor counter, webring, themes) was created before I started using Kiro, outside Kiro. Everything below was done with Kiro Web (connected to this repository only) and Kiro CLI.

Spec-driven development: the repo contains a spec at `.kiro/specs/static-export`. I asked Kiro Web to implement it step by step. Kiro wrote design.md, worked through the six tasks in tasks.md and opened PR #1 (10 files): a "take your ghost with you" export. `GET /api/me/export` returns a self-contained ZIP (index.html + data.json) built from a fixed allow-list of fields, with a per-user rate limit and a dashboard button. I read the diff, ran `npm test` myself (17/17) and tested the button before merging.

Agent hook: I asked Kiro to create `.kiro/hooks/test-on-save.json` (trigger PostFileSave on server/ and tests/, runs `npm test`). Kiro first wrote it outside the repo folder; I caught that from the path in its permission prompt and it moved the hook into the repo (PR #2). In Kiro Web the hook never fired; the Kiro docs say file triggers run in the IDE and CLI V3, not Web. In Kiro CLI 3.3.0 a temporary probe hook with the same trigger and matcher ran `npm test` automatically after the agent edited a test file (log showed 18/18 passing). I did not capture the output of the repo's own hook.

Small Kiro Web iterations: PR #3 (export page no longer says "Be the first ghost to sign!", plus a test), PR #4 (footer text corrected; merged after reading the PR summary, without reading the diff), PR #5 (createZip signature test). In the PR #5 session Kiro itself reported that it could not confirm the hook ran.

Steering: `.kiro/steering` has product, tech and structure docs; Kiro updated structure.md in PR #1. Kiro reported that steering did not affect its later changes, so I do not claim it improved its output.

Not used: Kiro IDE, Crew, custom agents, MCP, powers, property-based testing.

## Features
- 🏚️ One public page per user at `/u/<username>`, server-rendered (fast, SEO-friendly, works without JS)
- 📖 Guestbook (owner moderation, per-IP rate limiting) and 🔢 honest visitor counter (once per visitor per day, owner excluded)
- 🕸️ Webring navigation (previous / next / random) and a searchable directory of pages
- 🎨 Four themes: Haunted Mansion, Neon Void, Vapor Cemetery, Pumpkin Patch
- ✍️ Dashboard with live preview, link manager and the 🔮 Séance copywriter (uses Claude when `ANTHROPIC_API_KEY` is set, otherwise a built-in template generator)
- 📦 Export: download a self-contained ZIP of your page (`index.html` with inlined theme, no JavaScript) and `data.json` (page fields, links, guestbook) from the dashboard
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
| GET | `/api/me/export` | ZIP of your page and guestbook (auth, 5 per 10 min) |
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
