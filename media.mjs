// Encodes media for the site with ffmpeg, on Luca's machine only (never in CI): photos, loops, players and
// embed posters, next to the page that uses them, recorded in content/media.json. The build refuses media that
// skipped this script. Masters (original exports) never enter the repo.
//
// Every JPEG, PNG and MP4 it writes names Luca as author (AVIF and WebP can't carry it here).
//
//   node media.mjs <master> <content path> [--poster <seconds>] [--bg <hex>] [--sample] [--force]
//   node media.mjs --embed <url> <page dir> [--from <still>] [--sample] [--force]
//   node media.mjs --remove <content path>          (the entry and its files; the Markdown line is yours to delete)
//
// The content path's extension decides: .jpg a photo, .png an image with transparency (kept: WebP widths and
// a PNG), .mp4 a clip. A transparent master as .jpg needs --bg <hex>, which flattens it onto that colour.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { NAME_RE, LIMITS, loadManifest, parseEmbed, embedPosterKey, videoKind } from './lib/media.mjs';

const PHOTO_WIDTHS = [800, 1600, 2400];
const PORTRAIT_MAX = 1200; // portrait-orientation media render 440 px wide
const VIDEO_MAX = 1920;
const H264_PROFILE = { Baseline: '42', 'Constrained Baseline': '42', Main: '4d', High: '64' };
const AV1_PROFILE = { Main: 0, High: 1, Professional: 2 };
const scale = (w) => `scale='trunc(min(${w},iw)/2)*2':-2:flags=lanczos`;
const BASE = ['-hide_banner', '-loglevel', 'error', '-y'];
const AVIF = ['-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '28', '-cpu-used', '4', '-pix_fmt', 'yuv420p'];
const jpeg = (q) => ['-c:v', 'mjpeg', '-q:v', String(q), '-pix_fmt', 'yuvj420p'];
const CODEC = { avif: () => AVIF, jpg: jpeg, webp: () => ['-c:v', 'libwebp', '-pix_fmt', 'yuva420p', '-quality', '85'], png: () => ['-c:v', 'png', '-pix_fmt', 'rgba', '-compression_level', '9'] };
const ALPHA_FMT = /^(rgba|bgra|argb|abgr|ya\d|yuva|gbrap|rgba64|bgra64|pal8)/;

// Not a formal rights statement: a name on the file, in case it travels without the page.
export const AUTHOR = 'Luca Molluso';
export const COPYRIGHT = 'Luca Molluso, lucamolluso.com';

/** The JPEG with an Exif APP1 segment (Artist, Copyright) right after SOI. */
export function withExif(jpeg) {
  const strings = [[0x013b, AUTHOR], [0x8298, COPYRIGHT]].map(([tag, text]) => [tag, Buffer.from(`${text}\0`, 'ascii')]);
  const ifd = Buffer.alloc(2 + strings.length * 12 + 4);
  ifd.writeUInt16LE(strings.length, 0);
  let offset = 8 + ifd.length;
  strings.forEach(([tag, data], k) => {
    const at = 2 + k * 12;
    ifd.writeUInt16LE(tag, at);
    ifd.writeUInt16LE(2, at + 2); // ASCII
    ifd.writeUInt32LE(data.length, at + 4);
    ifd.writeUInt32LE(offset, at + 8);
    offset += data.length;
  });
  const tiff = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0]), ifd, ...strings.map(([, d]) => d)]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), head, payload, jpeg.subarray(2)]);
}

/** The PNG with tEXt chunks (Author, Copyright) right after IHDR. */
export function withPngText(png) {
  const chunk = (key, text) => {
    const body = Buffer.concat([Buffer.from('tEXt', 'ascii'), Buffer.from(`${key}\0${text}`, 'latin1')]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length - 4);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  return Buffer.concat([png.subarray(0, 33), chunk('Author', AUTHOR), chunk('Copyright', COPYRIGHT), png.subarray(33)]);
}

const tag = (file, fn) => fs.writeFileSync(file, fn(fs.readFileSync(file)));

/** The RFC 6381 codec string browsers match in <source type>. */
export function codecString(s) {
  const hex = (n) => Number(n).toString(16).padStart(2, '0');
  if (s.codec_name === 'h264') return `avc1.${H264_PROFILE[s.profile] ?? '64'}00${hex(s.level)}`;
  if (s.codec_name === 'av1') {
    const depth = /10/.test(s.pix_fmt ?? '') ? '10' : '08';
    return `av01.${AV1_PROFILE[s.profile] ?? 0}.${String(s.level).padStart(2, '0')}M.${depth}`;
  }
  throw new Error(`no codec string for ${s.codec_name}`);
}

/** bg ('#rrggbb') with size ({width, height}, the display size) flattens transparency onto that colour. */
export const photoArgs = (master, out, width, format, { q = 3, bg = null, size = null } = {}) => [
  ...BASE, '-i', master,
  ...(bg ? ['-f', 'lavfi', '-i', `color=c=0x${bg.replace('#', '')}:s=${size.width}x${size.height}`, '-filter_complex', `[1:v][0:v]overlay=format=auto:shortest=1,${scale(width)}`] : ['-vf', scale(width)]),
  '-map_metadata', '-1', '-frames:v', '1', ...CODEC[format](q), out,
];

export const videoArgs = (master, out, codec, { audio }) => [
  ...BASE, '-i', master, '-map_metadata', '-1', '-metadata', `artist=${AUTHOR}`, '-metadata', `copyright=${COPYRIGHT}`, '-map', '0:v:0', ...(audio ? ['-map', '0:a:0'] : []),
  '-vf', scale(VIDEO_MAX), '-pix_fmt', 'yuv420p',
  ...(codec === 'h264' ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-profile:v', 'high'] : ['-c:v', 'libsvtav1', '-preset', '6', '-crf', '35']),
  ...(audio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']), '-movflags', '+faststart', out,
];

export const posterArgs = (master, out, seconds, format) =>
  [...BASE, '-ss', String(seconds), '-i', master, '-map_metadata', '-1', '-frames:v', '1', '-vf', scale(VIDEO_MAX), ...(format === 'avif' ? AVIF : jpeg(3)), out];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => reject(new Error(`${cmd}: ${e.message} (is ffmpeg installed?)`)));
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} failed: ${err.trim()}`))));
  });
}

async function probe(file) {
  const j = JSON.parse(await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]));
  const v = j.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`${file}: no picture in it`);
  return { video: v, width: v.width, height: v.height, duration: Number(j.format.duration ?? 0), audio: j.streams.some((s) => s.codec_type === 'audio') };
}

/** The size a picture shows at. ffprobe reports the coded size, but ffmpeg turns phone photos upright
 *  (EXIF orientation) when it encodes, so measure a tiny trial encode's shape. */
async function displaySize(master) {
  const coded = await probe(master);
  const tiny = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')), 'tiny.png');
  await run('ffmpeg', [...BASE, '-i', master, '-frames:v', '1', '-vf', 'scale=-2:64', tiny]);
  const t = await probe(tiny);
  fs.rmSync(path.dirname(tiny), { recursive: true, force: true });
  const r = t.width / t.height;
  const upright = Math.abs(r - coded.width / coded.height) <= Math.abs(r - coded.height / coded.width);
  return upright ? { width: coded.width, height: coded.height } : { width: coded.height, height: coded.width };
}

/** True when the master has pixels that aren't fully opaque. */
async function hasAlpha(master) {
  if (!ALPHA_FMT.test((await probe(master)).video.pix_fmt ?? '')) return false;
  const alpha = await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', [...BASE, '-i', master, '-frames:v', '1', '-vf', 'format=rgba,alphaextract', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const parts = [];
    p.stdout.on('data', (d) => parts.push(d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(parts)) : reject(new Error(`ffmpeg failed reading the alpha of ${master}`))));
  });
  return alpha.some((a) => a < 255);
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const bytes = (file) => fs.statSync(file).size;

export function writeManifestEntry(contentDir, key, entry) {
  const m = { ...loadManifest(contentDir), [key]: entry };
  const sorted = Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
  fs.writeFileSync(path.join(contentDir, 'media.json'), `${JSON.stringify(sorted, null, 2)}\n`);
}

const entryFiles = (e) => [...e.variants.map((v) => v.file), ...(e.poster ? [e.poster.jpg.file, e.poster.avif.file] : [])];

async function encodePhoto(master, key, contentDir, bg) {
  const transparent = await hasAlpha(master);
  const png = key.endsWith('.png');
  if (png && !transparent) throw new Error(`${key}: no transparency in this master: name it .jpg (photos are JPEG)`);
  if (!png && transparent && !bg) throw new Error(`${key}: this master has transparency: name it .png to keep it, or pass --bg <hex> to flatten it onto a colour`);
  const size = await displaySize(master);
  const { width, height } = size;
  const base = key.replace(/\.(jpg|png)$/, '');
  const canonical = Math.min(height > width ? PORTRAIT_MAX : PHOTO_WIDTHS.at(-1), width);
  const widths = [...PHOTO_WIDTHS.filter((w) => w < canonical), canonical];
  if (png) return encodeTransparent(master, key, base, widths, contentDir);
  const flat = transparent ? { bg, size } : {};
  const variants = [];
  let outHeight = height;
  for (const w of widths) {
    const avif = `${base}.${w}.avif`;
    await run('ffmpeg', photoArgs(master, path.join(contentDir, avif), w, 'avif', flat));
    variants.push({ file: avif, width: w, bytes: bytes(path.join(contentDir, avif)), type: 'image/avif' });
  }
  for (const w of widths) {
    const jpg = w === canonical ? `${base}.jpg` : `${base}.${w}.jpg`;
    const out = path.join(contentDir, jpg);
    // Step the JPEG quality down until the file fits the photo budget (q 3 is the starting point).
    for (let q = 3; q <= 10; q++) {
      await run('ffmpeg', photoArgs(master, out, w, 'jpg', { q, ...flat }));
      tag(out, withExif);
      if (bytes(out) <= LIMITS.photo) break;
    }
    if (w === canonical) outHeight = (await probe(out)).height;
    variants.push({ file: jpg, width: w, bytes: bytes(out), type: 'image/jpeg' });
  }
  return { kind: 'photo', width: canonical, height: outHeight, master: sha256(master), variants, ...(transparent ? { bg } : {}) };
}

/** Transparency kept: WebP (with alpha) at each width, and one PNG fallback, as wide as fits the photo budget. */
async function encodeTransparent(master, key, base, widths, contentDir) {
  const variants = [];
  for (const w of [...widths].reverse()) {
    const webp = `${base}.${w}.webp`;
    await run('ffmpeg', photoArgs(master, path.join(contentDir, webp), w, 'webp'));
    variants.push({ file: webp, width: w, bytes: bytes(path.join(contentDir, webp)), type: 'image/webp' });
  }
  const out = path.join(contentDir, key);
  const canonical = widths.at(-1);
  let pngWidth = canonical;
  // Browsers load the WebP; the PNG is the fallback (and the file someone saves), so it may get small.
  for (const w of [...new Set([canonical, 1600, 1200, 800, 640, 480, 320].filter((x) => x <= canonical))].sort((a, b) => b - a)) {
    pngWidth = w;
    await run('ffmpeg', photoArgs(master, out, w, 'png'));
    tag(out, withPngText);
    if (bytes(out) <= LIMITS.photo) break;
  }
  const { width, height } = await probe(out);
  variants.sort((a, b) => a.width - b.width).push({ file: key, width: pngWidth, bytes: bytes(out), type: 'image/png' });
  return { kind: 'photo', width, height, master: sha256(master), variants };
}

async function encodeVideo(master, key, contentDir, posterAt) {
  const src = await probe(master);
  const base = key.replace(/\.mp4$/, '');
  const files = { av1: `${base}.av1.mp4`, h264: `${base}.mp4`, jpg: `${base}.jpg`, avif: `${base}.avif` };
  const at = (f) => path.join(contentDir, f);
  await run('ffmpeg', videoArgs(master, at(files.av1), 'av1', { audio: src.audio }));
  await run('ffmpeg', videoArgs(master, at(files.h264), 'h264', { audio: src.audio }));
  await run('ffmpeg', posterArgs(master, at(files.jpg), posterAt, 'jpg'));
  tag(at(files.jpg), withExif);
  await run('ffmpeg', posterArgs(master, at(files.avif), posterAt, 'avif'));
  const av1 = await probe(at(files.av1));
  const h264 = await probe(at(files.h264));
  return {
    kind: 'video', width: h264.width, height: h264.height, duration: Math.round(h264.duration * 100) / 100, audio: src.audio, master: sha256(master), posterAt,
    variants: [
      { file: files.av1, bytes: bytes(at(files.av1)), type: `video/mp4; codecs="${codecString(av1.video)}"` },
      { file: files.h264, bytes: bytes(at(files.h264)), type: `video/mp4; codecs="${codecString(h264.video)}"` },
    ],
    poster: { jpg: { file: files.jpg, bytes: bytes(at(files.jpg)) }, avif: { file: files.avif, bytes: bytes(at(files.avif)) } },
  };
}

/** Encodes one master to the web files for `contentPath` (a .jpg photo or an .mp4 clip) and records it.
 *  An unchanged master (same file, same poster time) is skipped unless `force`: re-encoding is explicit. */
export async function encode(master, contentPath, { contentDir = 'content', poster = 0, bg = null, sample = false, force = false, log = () => {} } = {}) {
  const bad = contentPath.split('/').find((seg) => !NAME_RE.test(seg));
  if (bad) throw new Error(`content path "${contentPath}": file names use lowercase letters, digits, dots and dashes only ("${bad}")`);
  const kind = /\.(jpg|png)$/.test(contentPath) ? 'photo' : /\.mp4$/.test(contentPath) ? 'video' : null;
  if (!kind) throw new Error(`content path "${contentPath}": use .jpg, .png or .mp4 (a photo, an image with transparency, or a clip)`);
  if (bg && !/^#?[0-9a-f]{6}$/i.test(bg)) throw new Error(`--bg ${bg}: use a hex colour like #000000`);
  if (bg && !bg.startsWith('#')) bg = `#${bg}`;
  if (!fs.existsSync(master)) throw new Error(`no such master: ${master}`);
  fs.mkdirSync(path.join(contentDir, path.posix.dirname(contentPath)), { recursive: true });
  const old = loadManifest(contentDir)[contentPath];
  let entry;
  const same = old && old.master === sha256(master) && (old.kind !== 'video' || (old.posterAt ?? 0) === poster) && (old.bg ?? null) === (bg ?? null)
    && entryFiles(old).every((f) => fs.existsSync(path.join(contentDir, f)));
  if (same && !force) { entry = { ...old }; log(`${contentPath}: unchanged, skipped (use --force to encode it again)`); }
  else {
    entry = kind === 'photo' ? await encodePhoto(master, contentPath, contentDir, bg) : await encodeVideo(master, contentPath, contentDir, poster);
    // a smaller master makes fewer widths: the old entry's extra files would be orphans the build refuses
    if (old) for (const f of entryFiles(old)) if (!entryFiles(entry).includes(f)) fs.rmSync(path.join(contentDir, f), { force: true });
  }
  if (sample) entry.sample = true;
  else delete entry.sample;
  writeManifestEntry(contentDir, contentPath, entry);
  return entry;
}

async function download(url, to) {
  const r = await fetch(url);
  if (!r.ok) return false;
  fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
  return true;
}

/** The local poster an embed needs: from `from`, or the service's thumbnail, fetched once now. */
export async function embedPoster(url, pageDir, { contentDir = 'content', from = null, sample = false, force = false, log = () => {} } = {}) {
  const e = parseEmbed(url);
  if (!e) throw new Error(`${url}: embeds must be YouTube or Vimeo links`);
  let master = from;
  if (!master) {
    master = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'poster-')), 'thumb.jpg');
    if (e.service === 'youtube') {
      const ok = await download(`https://i.ytimg.com/vi/${e.id}/maxresdefault.jpg`, master)
        || await download(`https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`, master);
      if (!ok) throw new Error(`no thumbnail for ${url}: pass --from <still>`);
    } else {
      const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      const thumb = r.ok ? (await r.json()).thumbnail_url : null;
      if (!thumb || !(await download(thumb, master))) throw new Error(`no thumbnail for ${url}: pass --from <still>`);
    }
  }
  return encode(master, embedPosterKey(pageDir, e), { contentDir, sample, force, log });
}

/** Takes a medium off the site: its manifest entry and every file it lists. */
export function removeMedia(contentPath, { contentDir = 'content' } = {}) {
  const m = loadManifest(contentDir);
  if (!m[contentPath]) throw new Error(`${contentPath} isn't in media.json`);
  for (const f of entryFiles(m[contentPath])) fs.rmSync(path.join(contentDir, f), { force: true });
  delete m[contentPath];
  fs.writeFileSync(path.join(contentDir, 'media.json'), `${JSON.stringify(m, null, 2)}\n`);
}

async function main(args) {
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const bool = (name) => { const i = args.indexOf(name); if (i >= 0) args.splice(i, 1); return i >= 0; };
  const sample = bool('--sample');
  const force = bool('--force');
  const remove = flag('--remove');
  if (remove) { removeMedia(remove); console.log(`${remove}: removed, with its files`); return; }
  const embed = flag('--embed');
  const from = flag('--from');
  const poster = Number(flag('--poster') ?? 0);
  const bg = flag('--bg');
  let key;
  let entry;
  if (embed) {
    if (args.length !== 1) throw new Error('usage: node media.mjs --embed <url> <page dir> [--from <still>] [--sample]');
    entry = await embedPoster(embed, args[0], { from, sample, force, log: console.log });
    key = embedPosterKey(args[0], parseEmbed(embed));
  } else {
    if (args.length !== 2) throw new Error('usage: node media.mjs <master> <content path> [--poster <seconds>] [--bg <hex>] [--sample] [--force]');
    [, key] = args;
    entry = await encode(args[0], key, { poster, bg, sample, force, log: console.log });
  }
  const total = entryFiles(entry).reduce((s, f) => s + bytes(path.join('content', f)), 0);
  const kind = entry.kind === 'video' ? videoKind(entry) : 'photo';
  console.log(`${key}: ${kind} ${entry.width}×${entry.height}${entry.duration ? `, ${entry.duration} s` : ''}, ${entryFiles(entry).length} files, ${(total / 1024 / 1024).toFixed(2)} MB${entry.sample ? ' (sample)' : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
