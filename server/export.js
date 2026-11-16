import { renderExport } from './render.js';
import { createZip } from './zip.js';

const iso = (ts) => new Date(ts).toISOString();

/**
 * Build the downloadable archive for one page. Pure: no database or filesystem access.
 * Fields are copied one by one (allow-list) so internal columns such as password hashes can never leak.
 */
export function buildExport({ owner, page, entries, css, now = Date.now() }) {
  const html = renderExport({ owner, page, entries, css, exportedAt: now });
  const data = {
    exportedAt: iso(now),
    username: owner.username,
    page: {
      title: page.title,
      tagline: page.tagline,
      bio: page.bio,
      theme: page.theme,
      marquee: page.marquee,
      links: page.links.map((l) => ({ label: l.label, url: l.url })),
      visits: Number(page.visits),
      updatedAt: iso(page.updated_at),
    },
    guestbook: entries.map((en) => ({
      id: en.id,
      author: en.author,
      message: en.message,
      createdAt: iso(en.created_at),
    })),
  };
  return createZip(
    [
      { name: 'index.html', data: html },
      { name: 'data.json', data: `${JSON.stringify(data, null, 2)}\n` },
    ],
    new Date(now),
  );
}
