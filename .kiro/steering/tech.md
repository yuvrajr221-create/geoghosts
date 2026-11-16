---
inclusion: always
---
# Tech stack and conventions

- **Runtime:** Node.js >= 22.13, ES modules. **No npm dependencies**: use `node:http`, `node:sqlite`, `node:crypto`, `node:test`.
- **Database:** SQLite via `node:sqlite` (`DatabaseSync`), prepared statements only. Never build SQL with string concatenation of user input.
- **Auth:** scrypt password hashes, HMAC-signed `HttpOnly; SameSite=Lax` session cookie. Mutating endpoints require `application/json`.
- **Frontend:** vanilla JS single-page app in `public/` (hash routing), build-free. Build DOM with the `h()` helper or `textContent`; never assign user data to `innerHTML`.
- **Security headers:** strict CSP (`script-src 'self'`). Do not add inline scripts.
- **Tests:** `npm test` (node:test integration tests in `tests/`). Every new endpoint needs a happy-path and a failure-path test.
- **Style:** small modules, early returns, errors thrown as `HttpError(status, message)`.
