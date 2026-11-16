# Tasks: Static export

- [ ] 1. Write `design.md` for the export (ZIP without dependencies: use `node:zlib` and a minimal ZIP writer, or a tar.gz alternative)
- [ ] 2. Extract the shared page-rendering logic so the live page and the export reuse it
- [ ] 3. Implement `GET /api/me/export` with auth and rate limiting
- [ ] 4. Add integration tests (auth required, no secrets leaked, content escaped, archive structure valid)
- [ ] 5. Add the "Export my page" button to the dashboard
- [ ] 6. Update the README
