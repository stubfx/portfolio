// Pure maths for the flight. p is a segment's progress, 0 at pin start, 1 at pin end.

const STAGES = [
  ['approach', 0, 0.2],
  ['arrival', 0.2, 0.3],
  ['dwell', 0.3, 0.8],
  ['departure', 0.8, 1],
];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const round = (v) => Math.round(v * 1000) / 1000 + 0;

export function phaseAt(p) {
  const c = clamp(p);
  for (const [stage, start, end] of STAGES) {
    if (c < end || stage === 'departure') return { stage, t: clamp((c - start) / (end - start)) };
  }
}

export function segmentProgress(rectTop, segHeight, stageHeight) {
  const run = segHeight - stageHeight;
  return run > 0 ? -rectTop / run + 0 : (rectTop <= 0 ? 1 : 0);
}

export function flightFrame(p, { reduced = false } = {}) {
  const { stage, t } = phaseAt(p);
  const e = ease(t);
  const before = (s) => STAGES.findIndex(([n]) => n === stage) < STAGES.findIndex(([n]) => n === s);

  const prev = stage === 'approach'
    ? { y: lerp(0, -40, e), z: lerp(0, -600, e), opacity: lerp(1, 0, e) }
    : { y: -40, z: -600, opacity: 0 };

  let cover;
  if (stage === 'approach') cover = { scale: lerp(0.18, 0.9, e), z: lerp(-1200, -150, e), opacity: lerp(0, 1, e) };
  else if (stage === 'arrival') cover = { scale: lerp(0.9, 1, e), z: lerp(-150, 0, e), opacity: 1 };
  else if (stage === 'dwell') cover = { scale: 1, z: 0, opacity: 1 };
  // The cover clears out in the first 60% of departure, so the next log lands on black, not through the cover.
  else cover = { scale: lerp(1, 1.6, e), z: 0, opacity: 1 - ease(clamp(t / 0.6)) };

  const next = stage === 'departure'
    ? { y: lerp(40, 0, e), z: lerp(-600, 0, e), opacity: ease(clamp((t - 0.35) / 0.65)) }
    : { y: 40, z: -600, opacity: 0 };

  const ground = stage === 'approach' ? e : stage === 'departure' ? 1 - e : 1;
  const graphDim = stage === 'approach' ? 1
    : stage === 'arrival' ? lerp(1, 0.2, t)
    : stage === 'dwell' ? 0.2
    : lerp(0.2, 1, t);
  const dwell = stage === 'dwell' ? t : before('dwell') ? 0 : 1;

  const out = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));
  if (reduced) {
    prev.y = prev.z = next.y = next.z = cover.z = 0;
    cover.scale = 1;
  }
  return {
    stage, prev: out(prev), cover: out(cover), next: out(next),
    ground: round(ground), graphDim: round(graphDim), dwell: reduced ? 0 : round(dwell),
  };
}

export function groundColor(g) {
  const k = 1 - clamp(g);
  return '#' + [30, 30, 46].map((c) => Math.round(c * k).toString(16).padStart(2, '0')).join('');
}
