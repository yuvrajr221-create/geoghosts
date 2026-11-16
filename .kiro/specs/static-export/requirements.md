# Requirements: Static export ("take your ghost with you")

## Introduction
The old web died partly because people lost their pages when hosts shut down. Owners should be able to download
a self-contained copy of their page and guestbook.

## Requirements

### R1: Download
**User story:** As a page owner, I want to download my page, so that I keep my content if the service disappears.
1. WHEN a logged-in owner requests `GET /api/me/export` THEN the system SHALL return a ZIP containing `index.html` (self-contained, theme CSS inlined, no JavaScript) and `data.json` (page fields, links, guestbook entries).
2. The system SHALL NOT include password hashes, session data or other users' private data.
3. IF the request is not authenticated THEN the system SHALL respond with 401.

### R2: Dashboard integration
1. The dashboard SHALL offer an "Export my page" button that downloads the ZIP.

### R3: Safety
1. All user content in the exported HTML SHALL be escaped exactly as in the live page.
2. The endpoint SHALL be rate-limited.
