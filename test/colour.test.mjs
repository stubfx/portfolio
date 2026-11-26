import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHex, mixSrgb, mixOklab } from '../src/build/colour.mjs';

test('hex round-trips', () => {
  assert.deepEqual(hexToRgb('#1e1e2e'), [30, 30, 46]);
  assert.equal(rgbToHex([30, 30, 46]), '#1e1e2e');
  assert.throws(() => hexToRgb('red'), /#rrggbb/);
});

test('sRGB mixing matches color-mix(in srgb): t is the share of the second colour', () => {
  assert.equal(mixSrgb('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mixSrgb('#1e1e2e', '#120c08', 0), '#1e1e2e');
  assert.equal(mixSrgb('#1e1e2e', '#120c08', 1), '#120c08');
  assert.equal(mixSrgb('#000000', '#ff0000', 0.25), '#400000');
});

test('OKLab mixing: endpoints exact, a colour mixed with itself unchanged, grey stays grey', () => {
  assert.equal(mixOklab('#000000', '#ffffff', 0), '#000000');
  assert.equal(mixOklab('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mixOklab('#89b4fa', '#89b4fa', 0.37), '#89b4fa');
  const [r, g, b] = hexToRgb(mixOklab('#000000', '#ffffff', 0.5));
  assert.ok(r === g && g === b && r > 90 && r < 110, `mid grey in OKLab: ${[r, g, b]}`); // L 0.5 is about #636363
});
