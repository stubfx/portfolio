// The media manifest (content/media.json, written by media.mjs), embeds, kinds and budgets.
import fs from 'node:fs';
import path from 'node:path';

export const MB = 1024 * 1024;
export const LIMITS = { loop: 10 * MB, loopWarn: 6 * MB, player: 60 * MB, photo: 600 * 1024, total: 700 * MB };
export const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
export const MEDIA_EXT = /\.(jpe?g|png|webp|avif|mp4)$/i;

export function loadManifest(contentDir) {
  const p = path.join(contentDir, 'media.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

function seconds(t) {
  if (!t) return 0;
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  return m ? (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0) : 0;
}

/** @returns {{service: 'youtube'|'vimeo', id: string, hash?: string, start?: number} | null} */
export function parseEmbed(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www|m)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' && u.pathname === '/watch') id = u.searchParams.get('v');
  if (id !== null) {
    if (!/^[\w-]+$/.test(id)) return null;
    const start = seconds(u.searchParams.get('t'));
    return start ? { service: 'youtube', id, start } : { service: 'youtube', id };
  }
  if (host === 'vimeo.com') {
    const m = /^\/(\d+)(?:\/([0-9a-f]+))?\/?$/.exec(u.pathname);
    if (m) return m[2] ? { service: 'vimeo', id: m[1], hash: m[2] } : { service: 'vimeo', id: m[1] };
  }
  return null;
}

export function embedSrc(e) {
  if (e.service === 'youtube') return `https://www.youtube-nocookie.com/embed/${e.id}?autoplay=1${e.start ? `&start=${e.start}` : ''}`;
  return `https://player.vimeo.com/video/${e.id}?autoplay=1&dnt=1${e.hash ? `&h=${e.hash}` : ''}`;
}

export const embedPosterKey = (pageDir, e) => path.posix.join(pageDir, `${e.service}-${e.id}.jpg`);

export const videoKind = (entry) => (!entry.audio && entry.duration <= 30 ? 'loop' : 'player');

const url = (key) => `/${key.split('/').map(encodeURIComponent).join('/')}`;

/** The renderer's view of one manifest entry (see lib/render.mjs), or null when the key isn't listed. */
export function mediaRef(manifest, key) {
  const e = manifest[key];
  if (!e) return null;
  if (e.kind === 'photo') {
    const of = (type) => e.variants.filter((v) => v.type === type).sort((a, b) => a.width - b.width).map((v) => ({ src: url(v.file), w: v.width }));
    return { kind: 'photo', src: url(key), width: e.width, height: e.height, narrow: e.height > e.width, avif: of('image/avif'), jpg: of('image/jpeg') };
  }
  const av1First = [...e.variants].sort((a, b) => Number(b.type.includes('av01')) - Number(a.type.includes('av01')));
  return {
    kind: videoKind(e), src: url(key), width: e.width, height: e.height,
    poster: { jpg: url(e.poster.jpg.file), avif: url(e.poster.avif.file) },
    sources: av1First.map((v) => ({ src: url(v.file), type: v.type })),
  };
}

const size = (bytes) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

function walk(dir, base = '') {
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...walk(path.join(dir, d.name), rel));
    else out.push(rel);
  }
  return out;
}

/** Files exist with their recorded sizes, nothing unlisted, budgets. `file` is content-relative. */
export function checkManifest(manifest, contentDir) {
  const errors = [];
  const warnings = [];
  const listed = new Set();
  let total = 0;
  for (const [key, e] of Object.entries(manifest)) {
    const loop = e.kind === 'video' && videoKind(e) === 'loop';
    const files = e.variants.map((v) => ({ ...v, cap: e.kind === 'photo' ? 'photo' : loop ? 'loop' : 'player' }));
    if (e.poster) files.push({ ...e.poster.jpg, cap: 'photo' }, { ...e.poster.avif, cap: 'photo' });
    for (const f of files) {
      listed.add(f.file);
      const p = path.join(contentDir, f.file);
      if (!fs.existsSync(p)) { errors.push({ file: f.file, message: `missing (listed in media.json for ${key}): run node media.mjs again` }); continue; }
      const bytes = fs.statSync(p).size;
      total += bytes;
      if (bytes !== f.bytes) errors.push({ file: f.file, message: `size changed since media.mjs wrote it (${f.bytes} → ${bytes} bytes): run node media.mjs again` });
      if (f.cap === 'photo' && bytes > LIMITS.photo) errors.push({ file: f.file, message: `over 600 KB (${size(bytes)})` });
      if (f.cap === 'loop' && bytes > LIMITS.loop) errors.push({ file: f.file, message: `over 10 MB (${size(bytes)}): shorten or simplify the loop` });
      else if (f.cap === 'loop' && bytes > LIMITS.loopWarn) warnings.push({ file: f.file, message: `over 6 MB (${size(bytes)})` });
      if (f.cap === 'player' && bytes > LIMITS.player) errors.push({ file: f.file, message: `over 60 MB (${size(bytes)}): put long videos on YouTube or Vimeo` });
    }
  }
  if (total > LIMITS.total) errors.push({ file: 'media.json', message: `all media over 700 MB (${size(total)})` });
  for (const rel of walk(contentDir)) {
    if (MEDIA_EXT.test(rel) && !listed.has(rel)) errors.push({ file: rel, message: 'not in media.json: add it with node media.mjs' });
  }
  return { errors, warnings };
}
