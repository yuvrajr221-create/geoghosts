# Tasks: Static export

- [x] 1. Write `design.md` for the export (ZIP without dependencies: use `node:zlib` and a minimal ZIP writer, or a tar.gz alternative)
- [x] 2. Extract the shared page-rendering logic so the live page and the export reuse it
- [x] 3. Implement `GET /api/me/export` with auth and rate limiting
- [x] 4. Add integration tests (auth required, no secrets leaked, content escaped, archive structure valid)
- [x] 5. Add the "Export my page" button to the dashboard
- [x] 6. Update the README
