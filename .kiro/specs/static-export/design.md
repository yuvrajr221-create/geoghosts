# Design: Static export

## Overview
`GET /api/me/export` returns `geoghosts-<username>.zip` for the logged-in owner. The archive holds:
- `index.html`: the page, self-contained (theme tokens and `profile.css` inlined, no JavaScript, no external requests except the owner's own outbound links)
- `data.json`: page fields, links and guestbook entries as plain JSON

## Archive format: minimal ZIP writer (no dependencies)
The stack steering forbids npm dependencies, so `server/zip.js` writes ZIP files with Node built-ins.
A tar.gz alternative was rejected: ZIP opens natively on Windows and macOS, which matters for non-technical owners.

`createZip([{ name, data }]) -> Buffer`
- Per file: local file header, deflated data, then a central directory entry; finally the end-of-central-directory record.
- Compression: `zlib.deflateRawSync` (method 8). CRC-32: `zlib.crc32` (Node >= 22.2, we require >= 22.13).
- File names are UTF-8 (general purpose flag bit 11). Names are chosen by the server, never by users.
- Fixed modification time from the export timestamp (DOS format). No ZIP64: the export is small (page plus at most a few hundred guestbook entries), and the writer throws if a file or the archive would exceed 4 GiB or 65535 entries.

## Shared rendering
`server/render.js` currently builds the whole profile page in one function. It is split so both outputs share the same escaping and markup:
- Internal section builders (`heroHtml`, `bioHtml`, `counterHtml`, `linksHtml`, `entriesHtml`, `themeVars`) all escape with `escapeHtml`.
- `renderProfile(...)` (live page) keeps its signature and output: stylesheet link, guestbook form, owner delete buttons, webring nav, `profile.js`.
- `renderExport({ owner, page, entries, css, exportedAt })` (new) uses the same builders but:
  - inlines `css` in a `<style>` element
  - omits the guestbook form, delete buttons, webring nav, footer links to the live site and the script tag
  - adds a restrictive `<meta http-equiv="Content-Security-Policy">` (`default-src 'none'; style-src 'unsafe-inline'; img-src data:`) so a downloaded file cannot run scripts even if an escaping bug existed
  - shows the visitor count as a snapshot and a "Exported on <date>" note

Live-page output must stay byte-for-byte compatible with existing tests (XSS test).

## Export assembly
`server/export.js` exports `buildExport({ owner, page, entries, css, now }) -> Buffer`. It is pure (no DB, no filesystem), so it can be unit tested.
`profile.css` is read once at app start from `public/` and passed in.

`data.json` shape:
```json
{
  "exportedAt": "ISO-8601",
  "username": "casper",
  "page": { "title": "", "tagline": "", "bio": "", "theme": "", "marquee": "", "links": [{ "label": "", "url": "" }], "visits": 0, "updatedAt": "ISO-8601" },
  "guestbook": [{ "id": 1, "author": "", "message": "", "createdAt": "ISO-8601" }]
}
```
The object is built field by field from an allow-list. Rows from the database are never spread in, so `pass_hash`, user ids and session data cannot leak. Guestbook author and message are already public on the live page.

## Endpoint
| Method | Path | Auth | Success | Failures |
|---|---|---|---|---|
| GET | /api/me/export | session cookie | 200 `application/zip`, `Content-Disposition: attachment; filename="geoghosts-<username>.zip"`, `Cache-Control: no-store` | 401 not logged in, 429 rate limited |

- Usernames match `[A-Za-z0-9_]{3,20}`, so the file name needs no further escaping.
- Rate limit: 5 exports per 10 minutes per user id (`rateLimiter`, same pattern as `generateLimit`). The auth check runs first, so anonymous callers get 401 without consuming limiter entries.
- The export reads all guestbook entries for the owner (new prepared statement `allEntries`, capped at 1000 rows), not just the latest 50 shown live.
- Note on routing: `/api/me/export` is a separate route from `/api/me`; the patterns are anchored, so they do not collide.

## Dashboard
An "Export my page" button next to "Open my page" in the actions row. The click handler fetches `/api/me/export`, turns the response into a Blob and triggers a download through a temporary `<a download>` element. Using `fetch` means a 401 or 429 shows an error toast with the server message instead of downloading a JSON error file. No inline scripts or new CSP sources are needed (`blob:` navigation by anchor click is not governed by `connect-src`).

## Security
- All user content is escaped by the shared builders; the export adds a CSP meta tag as defense in depth.
- Allow-listed `data.json` fields; no hashes or sessions.
- Auth required, per-user rate limit, response not cacheable.
- CSRF: GET with a side-effect-free read of the caller's own data and a download-only response, so SameSite=Lax cookies are sufficient.

## Testing (tasks.md item 4)
Integration tests in `tests/app.test.js` (plus a small ZIP parser helper in the test file that reads the central directory and inflates entries):
- 401 without a session
- ZIP has `index.html` and `data.json`, valid CRCs, correct content type and disposition
- `data.json` contains no `pass_hash`/password/session strings and no other users' data
- XSS payloads in bio, title and guestbook are escaped in `index.html`; no `<script` in the export
- Rate limit returns 429 after 5 exports
