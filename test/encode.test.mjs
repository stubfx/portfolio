import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { codecString, videoArgs, photoArgs, encode, embedPoster } from '../media.mjs';
import { loadManifest, checkManifest, videoKind } from '../lib/media.mjs';

const hasFfmpeg = spawnSync('ffprobe', ['-version']).status === 0 && spawnSync('ffmpeg', ['-version']).status === 0;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'media-'));
const ffmpeg = (...args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
  if (r.status !== 0) throw new Error(String(r.stderr));
};

test('codec strings', () => {
  assert.equal(codecString({ codec_name: 'h264', profile: 'High', level: 40 }), 'avc1.640028');
  assert.equal(codecString({ codec_name: 'h264', profile: 'Main', level: 31 }), 'avc1.4d001f');
  assert.equal(codecString({ codec_name: 'av1', profile: 'Main', level: 8, pix_fmt: 'yuv420p' }), 'av01.0.08M.08');
  assert.equal(codecString({ codec_name: 'av1', profile: 'Main', level: 12, pix_fmt: 'yuv420p10le' }), 'av01.0.12M.10');
});

test('args: no upscaling, no metadata, silent loops have no audio', () => {
  const a = videoArgs('m.mov', 'o.mp4', 'h264', { audio: false });
  assert.ok(a.includes('-an'));
  assert.ok(a.includes('-map_metadata'));
  assert.ok(a.join(' ').includes('min(1920,iw)'));
  assert.ok(a.includes('+faststart'));
  const s = videoArgs('m.mov', 'o.av1.mp4', 'av1', { audio: true });
  assert.ok(s.includes('libsvtav1') && s.includes('aac') && !s.includes('-an'));
  assert.ok(photoArgs('m.png', 'o.avif', 800, 'avif').join(' ').includes('min(800,iw)'));
});

test('rejects bad names and unknown kinds', async () => {
  await assert.rejects(encode('m.png', 'work/x/My Hero.jpg', { contentDir: tmp() }), /lowercase/);
  await assert.rejects(encode('m.png', 'work/x/hero.png', { contentDir: tmp() }), /\.jpg or \.mp4/);
});

test('encodes a silent clip into a loop entry', { skip: !hasFfmpeg, timeout: 180000 }, async () => {
  const dir = tmp();
  const master = path.join(tmp(), 'master.mkv'); // odd size on purpose: the encode must round to even
  ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=641x361:rate=30', '-t', '2', '-c:v', 'ffv1', master);
  const entry = await encode(master, 'work/t/clip.mp4', { contentDir: dir, poster: 1 });
  assert.equal(entry.kind, 'video');
  assert.equal(entry.audio, false);
  assert.ok(Math.abs(entry.duration - 2) < 0.2, String(entry.duration));
  assert.equal(videoKind(entry), 'loop');
  assert.equal(entry.width % 2, 0);
  assert.match(entry.variants[0].type, /^video\/mp4; codecs="av01\./);
  assert.match(entry.variants[1].type, /^video\/mp4; codecs="avc1\./);
  assert.equal(entry.variants[1].file, 'work/t/clip.mp4');
  for (const f of ['clip.mp4', 'clip.av1.mp4', 'clip.jpg', 'clip.avif']) assert.ok(fs.existsSync(path.join(dir, 'work/t', f)), f);
  assert.deepEqual(Object.keys(loadManifest(dir)), ['work/t/clip.mp4']);
  assert.deepEqual(checkManifest(loadManifest(dir), dir).errors, []);
});

test('encodes a photo into three widths, never upscaled', { skip: !hasFfmpeg, timeout: 180000 }, async () => {
  const dir = tmp();
  const big = path.join(tmp(), 'big.png');
  const small = path.join(tmp(), 'small.png');
  ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=3000x2000', '-frames:v', '1', big);
  ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=1000x700', '-frames:v', '1', small);
  const e = await encode(big, 'work/t/hero.jpg', { contentDir: dir, sample: true });
  assert.equal(e.kind, 'photo');
  assert.equal(e.sample, true);
  assert.equal(e.width, 2400);
  assert.deepEqual(e.variants.filter((v) => v.type === 'image/avif').map((v) => v.width), [800, 1600, 2400]);
  assert.deepEqual(e.variants.filter((v) => v.type === 'image/jpeg').map((v) => [v.width, v.file]),
    [[800, 'work/t/hero.800.jpg'], [1600, 'work/t/hero.1600.jpg'], [2400, 'work/t/hero.jpg']]);
  const s = await encode(small, 'work/t/small.jpg', { contentDir: dir });
  assert.equal(s.width, 1000);
  assert.deepEqual(s.variants.filter((v) => v.type === 'image/jpeg').map((v) => v.width), [800, 1000]);
  assert.deepEqual(Object.keys(loadManifest(dir)), ['work/t/hero.jpg', 'work/t/small.jpg']);
  assert.deepEqual(checkManifest(loadManifest(dir), dir).errors, []);
});

test('an unchanged master is not encoded again', { skip: !hasFfmpeg, timeout: 120000 }, async () => {
  const dir = tmp();
  const m = path.join(tmp(), 'm.png');
  ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=900x600', '-frames:v', '1', m);
  await encode(m, 'p.jpg', { contentDir: dir });
  const before = fs.statSync(path.join(dir, 'p.jpg')).mtimeMs;
  await encode(m, 'p.jpg', { contentDir: dir });
  assert.equal(fs.statSync(path.join(dir, 'p.jpg')).mtimeMs, before);
});

test('embed poster from a local still', { skip: !hasFfmpeg, timeout: 120000 }, async () => {
  const dir = tmp();
  const still = path.join(tmp(), 'still.png');
  ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=1280x720', '-frames:v', '1', still);
  const e = await embedPoster('https://youtu.be/abc', 'work/t', { contentDir: dir, from: still });
  assert.equal(e.kind, 'photo');
  assert.deepEqual(Object.keys(loadManifest(dir)), ['work/t/youtube-abc.jpg']);
  await assert.rejects(embedPoster('https://example.com/v', 'work/t', { contentDir: dir, from: still }), /YouTube or Vimeo/);
});

/** The same JPEG with an EXIF orientation tag, as phones write it (6 = shown turned 90° clockwise). */
function withOrientation(jpeg, o) {
  const tiff = Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, o, 0, 0, 0, 0, 0, 0, 0]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, payload, jpeg.subarray(2)]);
}
const widthOf = (file) => Number(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim());

test('a phone photo turned by EXIF is measured the way it shows', { skip: !hasFfmpeg, timeout: 120000 }, async () => {
  const dir = tmp();
  const work = tmp();
  ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=1600x1200', '-frames:v', '1', path.join(work, 'coded.jpg'));
  fs.writeFileSync(path.join(work, 'phone.jpg'), withOrientation(fs.readFileSync(path.join(work, 'coded.jpg')), 6));
  const e = await encode(path.join(work, 'phone.jpg'), 'p.jpg', { contentDir: dir });
  assert.deepEqual([e.width, e.height], [1200, 1600]);
  assert.deepEqual(e.variants.filter((v) => v.type === 'image/avif').map((v) => v.width), [800, 1200]);
  assert.equal(widthOf(path.join(dir, 'p.1200.avif')), 1200);
  assert.equal(widthOf(path.join(dir, 'p.jpg')), 1200);
});

test('re-encoding is explicit: a new poster time or force encodes again, otherwise it says so', { skip: !hasFfmpeg, timeout: 180000 }, async () => {
  const dir = tmp();
  const master = path.join(tmp(), 'm.mkv');
  ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30', '-t', '3', '-c:v', 'ffv1', master);
  const said = [];
  const log = (m) => said.push(m);
  const poster = () => fs.statSync(path.join(dir, 'c.jpg')).mtimeMs;
  await encode(master, 'c.mp4', { contentDir: dir, poster: 0, log });
  const first = poster();
  await encode(master, 'c.mp4', { contentDir: dir, poster: 0, log });
  assert.equal(poster(), first);
  assert.match(said.join('\n'), /unchanged/);
  const moved = await encode(master, 'c.mp4', { contentDir: dir, poster: 1, log });
  assert.equal(moved.posterAt, 1);
  assert.notEqual(poster(), first);
  const second = poster();
  await encode(master, 'c.mp4', { contentDir: dir, poster: 1, force: true, log });
  assert.notEqual(poster(), second);
});
