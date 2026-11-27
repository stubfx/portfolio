// Encodes media for the site with ffmpeg, on Luca's machine only (never in CI): photos, loops, players and
// embed posters, next to the page that uses them, recorded in content/media.json. The build refuses media that
// skipped this script. Masters (original exports) never enter the repo.
//
//   node media.mjs <master> <content path> [--poster <seconds>] [--sample] [--force]
//   node media.mjs --embed <url> <page dir> [--from <still>] [--sample] [--force]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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

export const photoArgs = (master, out, width, format, { q = 3 } = {}) =>
  [...BASE, '-i', master, '-map_metadata', '-1', '-frames:v', '1', '-vf', scale(width), ...(format === 'avif' ? AVIF : jpeg(q)), out];

export const videoArgs = (master, out, codec, { audio }) => [
  ...BASE, '-i', master, '-map_metadata', '-1', '-map', '0:v:0', ...(audio ? ['-map', '0:a:0'] : []),
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

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const bytes = (file) => fs.statSync(file).size;

export function writeManifestEntry(contentDir, key, entry) {
  const m = { ...loadManifest(contentDir), [key]: entry };
  const sorted = Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
  fs.writeFileSync(path.join(contentDir, 'media.json'), `${JSON.stringify(sorted, null, 2)}\n`);
}

const entryFiles = (e) => [...e.variants.map((v) => v.file), ...(e.poster ? [e.poster.jpg.file, e.poster.avif.file] : [])];

async function encodePhoto(master, key, contentDir) {
  const { width, height } = await displaySize(master);
  const base = key.replace(/\.jpg$/, '');
  const canonical = Math.min(height > width ? PORTRAIT_MAX : PHOTO_WIDTHS.at(-1), width);
  const widths = [...PHOTO_WIDTHS.filter((w) => w < canonical), canonical];
  const variants = [];
  let outHeight = height;
  for (const w of widths) {
    const avif = `${base}.${w}.avif`;
    await run('ffmpeg', photoArgs(master, path.join(contentDir, avif), w, 'avif'));
    variants.push({ file: avif, width: w, bytes: bytes(path.join(contentDir, avif)), type: 'image/avif' });
  }
  for (const w of widths) {
    const jpg = w === canonical ? `${base}.jpg` : `${base}.${w}.jpg`;
    const out = path.join(contentDir, jpg);
    // Step the JPEG quality down until the file fits the photo budget (q 3 is the starting point).
    for (let q = 3; q <= 10; q++) {
      await run('ffmpeg', photoArgs(master, out, w, 'jpg', { q }));
      if (bytes(out) <= LIMITS.photo) break;
    }
    if (w === canonical) outHeight = (await probe(out)).height;
    variants.push({ file: jpg, width: w, bytes: bytes(out), type: 'image/jpeg' });
  }
  return { kind: 'photo', width: canonical, height: outHeight, master: sha256(master), variants };
}

async function encodeVideo(master, key, contentDir, posterAt) {
  const src = await probe(master);
  const base = key.replace(/\.mp4$/, '');
  const files = { av1: `${base}.av1.mp4`, h264: `${base}.mp4`, jpg: `${base}.jpg`, avif: `${base}.avif` };
  const at = (f) => path.join(contentDir, f);
  await run('ffmpeg', videoArgs(master, at(files.av1), 'av1', { audio: src.audio }));
  await run('ffmpeg', videoArgs(master, at(files.h264), 'h264', { audio: src.audio }));
  await run('ffmpeg', posterArgs(master, at(files.jpg), posterAt, 'jpg'));
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
export async function encode(master, contentPath, { contentDir = 'content', poster = 0, sample = false, force = false, log = () => {} } = {}) {
  const bad = contentPath.split('/').find((seg) => !NAME_RE.test(seg));
  if (bad) throw new Error(`content path "${contentPath}": file names use lowercase letters, digits, dots and dashes only ("${bad}")`);
  const kind = /\.jpg$/.test(contentPath) ? 'photo' : /\.mp4$/.test(contentPath) ? 'video' : null;
  if (!kind) throw new Error(`content path "${contentPath}": use .jpg or .mp4 (a photo or a clip)`);
  if (!fs.existsSync(master)) throw new Error(`no such master: ${master}`);
  fs.mkdirSync(path.join(contentDir, path.posix.dirname(contentPath)), { recursive: true });
  const old = loadManifest(contentDir)[contentPath];
  let entry;
  const same = old && old.master === sha256(master) && (old.kind !== 'video' || (old.posterAt ?? 0) === poster)
    && entryFiles(old).every((f) => fs.existsSync(path.join(contentDir, f)));
  if (same && !force) { entry = { ...old }; log(`${contentPath}: unchanged, skipped (use --force to encode it again)`); }
  else entry = kind === 'photo' ? await encodePhoto(master, contentPath, contentDir) : await encodeVideo(master, contentPath, contentDir, poster);
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

async function main(args) {
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const bool = (name) => { const i = args.indexOf(name); if (i >= 0) args.splice(i, 1); return i >= 0; };
  const sample = bool('--sample');
  const force = bool('--force');
  const embed = flag('--embed');
  const from = flag('--from');
  const poster = Number(flag('--poster') ?? 0);
  let key;
  let entry;
  if (embed) {
    if (args.length !== 1) throw new Error('usage: node media.mjs --embed <url> <page dir> [--from <still>] [--sample]');
    entry = await embedPoster(embed, args[0], { from, sample, force, log: console.log });
    key = embedPosterKey(args[0], parseEmbed(embed));
  } else {
    if (args.length !== 2) throw new Error('usage: node media.mjs <master> <content path> [--poster <seconds>] [--sample] [--force]');
    [, key] = args;
    entry = await encode(args[0], key, { poster, sample, force, log: console.log });
  }
  const total = entryFiles(entry).reduce((s, f) => s + bytes(path.join('content', f)), 0);
  const kind = entry.kind === 'video' ? videoKind(entry) : 'photo';
  console.log(`${key}: ${kind} ${entry.width}×${entry.height}${entry.duration ? `, ${entry.duration} s` : ''}, ${entryFiles(entry).length} files, ${(total / 1024 / 1024).toFixed(2)} MB${entry.sample ? ' (sample)' : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
