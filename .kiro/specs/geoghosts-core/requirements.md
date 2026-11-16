# Requirements: GeoGhosts core

## Introduction
GeoGhosts lets anyone claim a haunted personal homepage with a guestbook, visitor counter and webring links.

## Requirements

### R1: Accounts
**User story:** As a visitor, I want to create an account, so that I can own a page.
1. WHEN a visitor submits a valid username (3-20 letters, digits, underscores) and a password of 8-128 characters THEN the system SHALL create the account, a default page, and a session.
2. IF the username is taken (case-insensitive) or reserved THEN the system SHALL reject the request with a clear message.
3. WHEN credentials are wrong THEN the system SHALL respond with the same error whether or not the username exists.
4. The system SHALL rate-limit authentication attempts per IP.

### R2: Page editing
**User story:** As a page owner, I want to edit my page, so that it reflects me.
1. The system SHALL let the owner edit title, tagline, bio, marquee, theme and up to 8 links.
2. IF a link is not an http(s) URL THEN the system SHALL reject it.
3. WHEN the owner saves THEN the public page SHALL show the changes immediately.

### R3: Public page
1. WHEN anyone opens `/u/<username>` THEN the system SHALL return server-rendered HTML with all user content HTML-escaped.
2. The page SHALL show a visitor counter, links, guestbook and webring navigation.

### R4: Visitor counter
1. The system SHALL count one visit per visitor per 24 hours (cookie-based) and SHALL NOT count the owner.

### R5: Guestbook
1. Anyone SHALL be able to sign a guestbook (name <= 30, message <= 300 characters), subject to a per-IP rate limit.
2. Only the page owner SHALL be able to delete entries on their page.

### R6: Webring and discovery
1. The system SHALL provide previous / next / random navigation across all pages, wrapping at the ends.
2. The home page SHALL list popular pages and support search by username or title.

### R7: Séance copywriter
1. WHEN a logged-in owner describes their interests THEN the system SHALL return a tagline, bio and marquee suggestion.
2. IF no AI key is configured or the AI call fails THEN the system SHALL fall back to a template generator.
