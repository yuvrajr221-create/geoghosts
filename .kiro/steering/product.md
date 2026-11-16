---
inclusion: always
---
# GeoGhosts: product context

GeoGhosts is a Kiroween 2026 **Resurrection** entry. It revives GeoCities-style personal homepages
(guestbooks, visitor counters, webrings, marquees) with a haunted theme and a modern, secure backend.

## Principles
- Every user owns one public page at `/u/<username>`; the page is server-rendered HTML, readable without JavaScript.
- Nostalgia in the *content*, quality in the *engineering*: accessible markup, responsive layouts, no dark patterns.
- Never trust user input: validate on write, escape on output, rate-limit anything public.
- Keep the app dependency-free where practical (Node built-ins only) so it is easy to audit and run.

## Tone
Playful and spooky in copy, calm and precise in error messages (say what went wrong and how to fix it).
