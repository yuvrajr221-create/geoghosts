---
inclusion: always
---
# Repository layout

- `server/index.js`: HTTP server, routing, static files, security headers
- `server/db.js`: SQLite schema; `server/auth.js`: hashing and sessions
- `server/validate.js`: input validation; `server/render.js`: server-side profile HTML
- `server/export.js` and `server/zip.js`: page export archive and the dependency-free ZIP writer
- `server/themes.js`: theme tokens; `server/ai.js`: optional Claude-powered "Séance" copywriter with template fallback
- `public/`: SPA (`index.html`, `app.js`, `styles.css`) and profile page assets (`profile.css`, `profile.js`)
- `tests/`: integration tests; `.kiro/`: steering and specs (must stay committed)
