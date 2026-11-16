const app = document.getElementById('app');
const nav = document.getElementById('nav');
const toastEl = document.getElementById('toast');
const state = { user: null, page: null, themes: [] };

// ---- helpers ---------------------------------------------------------------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
  return data;
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key === 'value') el.value = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

let toastTimer;
function toast(message, kind = 'good') {
  toastEl.textContent = message;
  toastEl.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.className = ''), 3200);
}

async function downloadExport(button) {
  button.disabled = true;
  try {
    const res = await fetch('/api/me/export', { credentials: 'same-origin' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not export your page');
    }
    const url = URL.createObjectURL(await res.blob());
    const link = h('a', { href: url, download: `geoghosts-${state.user.username}.zip` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast('Your ghost is packed. Check your downloads.');
  } catch (err) {
    toast(err.message, 'bad');
  } finally {
    button.disabled = false;
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function mount(...nodes) {
  app.replaceChildren(...nodes);
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

// ---- navigation ------------------------------------------------------------
function renderNav() {
  const items = [h('a', { href: '#/explore' }, 'Explore')];
  if (state.user) {
    items.push(
      h('a', { href: `/u/${state.user.username}`, target: '_blank', rel: 'noopener' }, 'My page'),
      h('a', { href: '#/dashboard' }, 'Dashboard'),
      h('button', { type: 'button', onclick: logout }, 'Log out'),
    );
  } else {
    items.push(h('a', { href: '#/login' }, 'Log in'), h('a', { class: 'btn btn-primary', href: '#/register' }, 'Claim your haunt'));
  }
  nav.replaceChildren(...items);
}

async function logout() {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  state.user = null;
  state.page = null;
  renderNav();
  location.hash = '#/';
  toast('You have left the séance.');
}

// ---- views -----------------------------------------------------------------
function homeView(scrollToExplore = false) {
  const grid = h('div', { class: 'cards', 'aria-live': 'polite' });
  const search = h('input', { class: 'search', type: 'search', placeholder: 'Search haunted pages…', 'aria-label': 'Search pages' });

  async function loadDirectory(q = '') {
    try {
      const { pages } = await api(`/api/pages?q=${encodeURIComponent(q)}`);
      grid.replaceChildren(
        ...(pages.length
          ? pages.map((p) =>
              h('a', { class: 'page-card', href: `/u/${p.username}` },
                h('h3', {}, p.title),
                h('p', {}, p.tagline || 'A mysterious ghost with nothing to say (yet).'),
                h('div', { class: 'meta' }, h('span', { class: 'chip' }, p.theme.replace('-', ' ')), h('span', {}, `${p.visits.toLocaleString()} visits · @${p.username}`)),
              ),
            )
          : [h('div', { class: 'empty-state' }, 'No pages found. Be the first to haunt this corner of the web.')]),
      );
    } catch {
      grid.replaceChildren(h('div', { class: 'empty-state' }, 'Could not load pages right now.'));
    }
  }
  search.addEventListener('input', debounce(() => loadDirectory(search.value), 250));
  loadDirectory();

  const primary = state.user
    ? h('a', { class: 'btn btn-primary', href: '#/dashboard' }, 'Open your dashboard')
    : h('a', { class: 'btn btn-primary', href: '#/register' }, 'Claim your haunt');

  const explore = h('section', { id: 'explore' },
    h('div', { class: 'section-head' }, h('h2', {}, 'Explore haunted pages'), search),
    grid,
  );

  mount(
    h('section', { class: 'hero' },
      h('div', {},
        h('span', { class: 'eyebrow' }, 'Resurrection · 1995 → 2026'),
        h('h1', {}, 'Resurrect the ', h('em', {}, 'personal web.')),
        h('p', { class: 'lead' }, 'GeoGhosts brings back the golden age of home pages: guestbooks, visitor counters and webrings, wrapped in a haunted theme and built on a secure, modern backend.'),
        h('div', { class: 'cta' }, primary, h('a', { class: 'btn btn-ghost', href: '#/explore' }, 'Explore pages')),
      ),
      h('div', { class: 'hero-art' }, h('img', { src: '/favicon.svg', alt: 'A friendly ghost' })),
    ),
    h('section', { class: 'features' },
      feature('📖', 'Living guestbooks', 'Visitors sign your page; only you can delete entries. Rate-limited and sanitised.'),
      feature('🔢', 'Honest visitor counter', 'One count per visitor per day. Your own visits never inflate the number.'),
      feature('🕸️', 'Webring navigation', 'Hop to the previous, next or a random ghost, just like the old web.'),
      feature('🔮', 'Séance copywriter', 'Describe your interests and get a tagline, bio and marquee. Uses Claude when configured.'),
    ),
    explore,
  );
  if (scrollToExplore) explore.scrollIntoView();
}

const feature = (icon, title, text) =>
  h('div', { class: 'feature' }, h('div', { class: 'icon', 'aria-hidden': 'true' }, icon), h('h3', {}, title), h('p', {}, text));

function authView(mode) {
  const isRegister = mode === 'register';
  const error = h('p', { class: 'error', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, isRegister ? 'Create my page' : 'Log in');
  const username = h('input', { type: 'text', name: 'username', autocomplete: 'username', required: true, minlength: 3, maxlength: 20, pattern: '[A-Za-z0-9_]{3,20}' });
  const password = h('input', { type: 'password', name: 'password', autocomplete: isRegister ? 'new-password' : 'current-password', required: true, minlength: 8, maxlength: 128 });

  const form = h('form', { class: 'stack', onsubmit: async (event) => {
    event.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    try {
      const { user } = await api(isRegister ? '/api/register' : '/api/login', { method: 'POST', body: { username: username.value, password: password.value } });
      state.user = user;
      await loadMe();
      renderNav();
      toast(isRegister ? 'Welcome to the other side!' : 'Welcome back, ghost.');
      location.hash = '#/dashboard';
    } catch (err) {
      error.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  } },
    h('label', { class: 'field' }, 'Username', h('small', {}, 'Letters, numbers and underscores. This becomes your page address.'), username),
    h('label', { class: 'field' }, 'Password', h('small', {}, 'At least 8 characters.'), password),
    error,
    submit,
  );

  mount(h('section', { class: 'auth panel' },
    h('h1', {}, isRegister ? 'Claim your haunt' : 'Welcome back'),
    h('p', { class: 'sub' }, isRegister ? 'Free forever. Your page goes live instantly at /u/yourname.' : 'Log in to edit your haunted homepage.'),
    form,
    h('p', { class: 'alt' }, isRegister ? 'Already haunting? ' : 'New here? ',
      h('a', { href: isRegister ? '#/login' : '#/register' }, isRegister ? 'Log in' : 'Create a page')),
  ));
  username.focus();
}

function dashboardView() {
  const page = structuredClone(state.page);
  const username = state.user.username;

  const fields = {
    title: h('input', { type: 'text', maxlength: 60, required: true, value: page.title }),
    tagline: h('input', { type: 'text', maxlength: 120, value: page.tagline }),
    bio: h('textarea', { maxlength: 1000, rows: 6 }),
    marquee: h('input', { type: 'text', maxlength: 140, value: page.marquee }),
  };
  fields.bio.value = page.bio;

  // theme picker
  const themeInputs = state.themes.map((t) =>
    h('label', { class: 'theme' },
      h('input', { type: 'radio', name: 'theme', value: t.id, checked: page.theme === t.id }),
      h('strong', {}, t.label),
      h('span', { class: 'dots' }, t.colors.map((c) => h('i', { style: `background:${c}` }))),
    ),
  );

  // links editor
  const linksBox = h('div');
  const addLinkBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { if (page.links.length < 8) { page.links.push({ label: '', url: 'https://' }); drawLinks(); } } }, '+ Add link');
  function drawLinks() {
    linksBox.replaceChildren(...page.links.map((link, i) =>
      h('div', { class: 'link-row' },
        h('input', { type: 'text', placeholder: 'Label', maxlength: 40, 'aria-label': `Link ${i + 1} label`, value: link.label, oninput: (e) => (link.label = e.target.value) }),
        h('input', { type: 'url', placeholder: 'https://…', maxlength: 300, 'aria-label': `Link ${i + 1} URL`, value: link.url, oninput: (e) => (link.url = e.target.value) }),
        h('button', { class: 'btn btn-danger', type: 'button', 'aria-label': `Remove link ${i + 1}`, onclick: () => { page.links.splice(i, 1); drawLinks(); } }, 'Remove'),
      ),
    ));
    addLinkBtn.disabled = page.links.length >= 8;
  }
  drawLinks();

  // séance
  const interests = h('input', { class: 'grow', type: 'text', maxlength: 200, placeholder: 'e.g. retro games, synthwave, haunted houses', 'aria-label': 'Your interests' });
  const seanceBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: async () => {
    seanceBtn.disabled = true;
    seanceBtn.textContent = 'Summoning…';
    try {
      const copy = await api('/api/generate', { method: 'POST', body: { interests: interests.value } });
      fields.tagline.value = copy.tagline;
      fields.bio.value = copy.bio;
      fields.marquee.value = copy.marquee;
      toast(`Séance complete (${copy.source === 'claude' ? 'Claude' : 'template'}). Review it, then save.`);
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      seanceBtn.disabled = false;
      seanceBtn.textContent = 'Summon copy';
    }
  } }, 'Summon copy');

  // preview
  const frame = h('iframe', { class: 'preview-frame', title: 'Live preview of your page', src: `/u/${username}`, loading: 'lazy' });
  const refresh = () => frame.setAttribute('src', `/u/${username}?t=${Date.now()}`);

  const exportBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => downloadExport(exportBtn) }, 'Export my page');
  const saveBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save changes');
  const form = h('form', { class: 'stack', onsubmit: async (event) => {
    event.preventDefault();
    saveBtn.disabled = true;
    try {
      const theme = form.querySelector('input[name=theme]:checked')?.value ?? page.theme;
      const { page: saved } = await api('/api/me/page', { method: 'PUT', body: {
        title: fields.title.value, tagline: fields.tagline.value, bio: fields.bio.value,
        marquee: fields.marquee.value, theme, links: page.links,
      } });
      state.page = saved;
      toast('Saved. Your page is live.');
      refresh();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      saveBtn.disabled = false;
    }
  } },
    h('label', { class: 'field' }, 'Page title', fields.title),
    h('label', { class: 'field' }, 'Tagline', fields.tagline),
    h('label', { class: 'field' }, 'About you', fields.bio),
    h('label', { class: 'field' }, 'Scrolling marquee', h('small', {}, 'The retro banner under your title.'), fields.marquee),
    h('div', { class: 'seance' },
      h('h3', {}, '🔮 Séance copywriter'),
      h('div', { class: 'row' }, interests, seanceBtn),
    ),
    h('fieldset', {}, h('legend', {}, 'Theme'), h('div', { class: 'themes' }, themeInputs)),
    h('fieldset', {}, h('legend', {}, 'Cursed links'), linksBox, addLinkBtn),
    h('div', { class: 'actions' }, saveBtn, h('a', { class: 'btn btn-ghost', href: `/u/${username}`, target: '_blank', rel: 'noopener' }, 'Open my page ↗'), exportBtn),
  );

  mount(h('div', { class: 'dash' },
    h('section', {}, h('h1', {}, 'Your haunted homepage'), h('p', { class: 'sub' }, `Live at /u/${username}. ${page.visits.toLocaleString()} visits so far.`), form),
    h('aside', { class: 'preview' },
      h('div', { class: 'preview-bar' }, h('h2', {}, 'Live preview'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: refresh }, 'Refresh')),
      frame,
    ),
  ));
}

// ---- router ----------------------------------------------------------------
async function loadMe() {
  const data = await api('/api/me');
  state.user = data.user;
  state.page = data.page;
}

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || '';
  renderNav();
  switch (hash) {
    case '':
      return homeView();
    case 'explore':
      return homeView(true);
    case 'login':
    case 'register':
      return state.user ? (location.hash = '#/dashboard') : authView(hash);
    case 'dashboard':
      return state.user ? dashboardView() : (location.hash = '#/login');
    default:
      return homeView();
  }
}

window.addEventListener('hashchange', route);

(async function start() {
  try {
    const [, themes] = await Promise.all([loadMe(), api('/api/themes')]);
    state.themes = themes.themes;
  } catch {
    toast('Could not reach the server.', 'bad');
  }
  route();
})();
