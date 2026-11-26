import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCover, planetGeometry } from '../src/build/cover.mjs';

const fixture = {
  title: 'Test project', accent: 'project', slug: 'test-project', hash: 'abc1234', branch: 'main', year: 2020,
  tags: ['3d'], palette: { bg: '#000000', fg: '#cdd6f4', accent: '#cba6f7' }, cover: {},
  cells: { Role: 'developer' }, html: '<p>Lede.</p>',
};

test('cover modes', () => {
  assert.match(renderCover(fixture, { mode: 'attachment' }), /^<a class="pc-att"/);
  assert.throws(() => renderCover(fixture, { mode: 'seg' }), /Unknown cover mode "seg"/);
});

test('attachment name starts with the chip text, escaped (WCAG 2.5.3)', () => {
  const html = renderCover({ ...fixture, title: 'Rock & "roll"' }, { mode: 'attachment' });
  assert.ok(html.includes(' aria-label="git show abc1234: open Rock &amp; &quot;roll&quot;">'), html.slice(0, 220));
  assert.match(html, /<span class="pc-chip" aria-hidden="true">git show abc1234<\/span><\/a>$/);
});

test('planet geometry: landscape unchanged, portrait in range, deterministic', () => {
  for (const h of ['a3f9c1e', '4d01c9a', '7be2104', 'b3e0f17']) {
    const g = planetGeometry(h);
    assert.deepEqual(g, planetGeometry(h));
    assert.ok(g.land.cx >= 96 && g.land.cx <= 136 && g.land.rad >= 14 && g.land.rad <= 24);
    assert.ok(g.port.x >= 55 && g.port.x <= 80 && g.port.y >= 18 && g.port.y <= 32 && g.port.r >= 26 && g.port.r <= 38);
  }
});

test('generative covers get a planet layer in every mode', () => {
  for (const mode of ['hero', 'card', 'attachment'])
    assert.match(renderCover(fixture, { mode }), /<div class="layer l-planet" aria-hidden="true" style="--cx:/);
  assert.match(renderCover(fixture, { mode: 'attachment' }), /<ellipse class="orbit" pathLength="1"/);
  assert.match(renderCover(fixture, { mode: 'hero' }), /<i class="cv-pool" aria-hidden="true"><\/i>/);
});

test('image cover has no planet', () => {
  const html = renderCover({ ...fixture, cover: { image: '/media/x/cover.webp' } }, { mode: 'attachment' });
  assert.doesNotMatch(html, /l-planet/); assert.match(html, /<img src="\/media\/x\/cover\.webp"/);
});
