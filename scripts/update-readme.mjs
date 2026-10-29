#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SITE = 'https://msbsu.com';
const LIMIT = 6;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const day = (iso) => { const d = new Date(iso || ''); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }); };
const cover = (id, fallback) => (id ? `${SITE}/api/media/${encodeURIComponent(id)}` : `${SITE}/assets/og/${fallback}.jpg`);

export const SECTIONS = {
  POSTS: {
    api: '/api/posts', key: 'posts', page: '/posts', more: 'See all posts',
    item: (p) => ({ url: `${SITE}/posts/${encodeURIComponent(p.slug)}`, image: cover(p.cover_media_id, 'posts'), title: p.title, text: p.excerpt, meta: day(p.published_at) }),
  },
  WORKS: {
    api: '/api/works', key: 'works', page: '/works', more: 'See all works',
    item: (w) => ({ url: `${SITE}/works/${encodeURIComponent(w.slug)}`, image: cover(w.cover_media_id, 'works'), title: w.title, text: w.description, meta: String(w.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4).join(' · ') }),
  },
  SALE: {
    api: '/api/on-sale', key: 'items', page: '/on-sale', more: 'See everything on sale',
    item: (s) => ({ url: `${SITE}/on-sale/${encodeURIComponent(s.slug)}`, image: cover(s.cover_media_id, 'on-sale'), title: s.title, text: s.tagline, meta: s.price_label }),
  },
};

const COLS = 3;
export function renderSection(name, list) {
  const s = SECTIONS[name];
  const items = (Array.isArray(list) ? list : []).slice(0, LIMIT).map(s.item);
  const arrow = `<img src="${SITE}/assets/icons/profile/forward.svg" alt="" width="14" height="14">`;
  const moreLink = `<a href="${SITE}${s.page}"><b>${esc(s.more)}</b> ${arrow}</a>`;
  if (!items.length) return `<p>Nothing here yet. ${moreLink}</p>`;
  const cells = items.map((it) => `<td width="33%" valign="top">
<a href="${esc(it.url)}"><img src="${esc(it.image)}" alt="${esc(it.title)}" width="100%"></a><br>
<a href="${esc(it.url)}"><b>${esc(clip(it.title, 64))}</b></a><br>
<sub>${esc(clip(it.text, 80))}${it.meta ? `<br>${esc(it.meta)}` : ''}</sub>
</td>`);
  const fits = items.length % COLS !== 0;
  if (fits) cells.push(`<td width="33%" align="center" valign="middle">${moreLink}</td>`);
  while (cells.length % COLS) cells.push('<td width="33%"></td>');
  const rows = [];
  for (let i = 0; i < cells.length; i += COLS) rows.push(`<tr>\n${cells.slice(i, i + COLS).join('\n')}\n</tr>`);
  return `<table>\n${rows.join('\n')}\n</table>${fits ? '' : `\n<p align="right">${moreLink}</p>`}`;
}

export function replaceSection(readme, name, html) {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  if (!re.test(readme)) throw new Error(`README has no <!-- ${name}:START --> … <!-- ${name}:END --> markers`);
  return readme.replace(re, (m, start, end) => `${start}\n${html}\n${end}`);
}


export async function updateReadme(readme, { fetchImpl = fetch } = {}) {
  let out = readme;
  for (const [name, s] of Object.entries(SECTIONS)) {
    const res = await fetchImpl(`${SITE}${s.api}`, { headers: { Accept: 'application/json', 'User-Agent': 'msbsurfi-profile-readme (+https://github.com/msbsurfi)' } });
    if (!res.ok) throw new Error(`${s.api} answered ${res.status}`);
    const data = await res.json();
    out = replaceSection(out, name, renderSection(name, data[s.key]));
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const file = process.argv[2] || 'README.md';
  const before = await readFile(file, 'utf8');
  const after = await updateReadme(before);
  if (after === before) console.log('README is already up to date.');
  else { await writeFile(file, after); console.log('README updated with the latest posts, works and on-sale items.'); }
}
