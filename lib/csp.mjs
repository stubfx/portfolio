// The Content-Security-Policy every page carries (docs/BUILD.md §15): the browser itself blocks
// any request to another site, except the YouTube/Vimeo player a visitor asks for.
import crypto from 'node:crypto';

export const FRAME_ORIGINS = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];

const hash = (script) => `'sha256-${crypto.createHash('sha256').update(script, 'utf8').digest('base64')}'`;

export function csp(inlineScripts) {
  return [
    "default-src 'self'", "img-src 'self' data:", "media-src 'self'", "style-src 'self'", "font-src 'self'",
    `script-src 'self' ${inlineScripts.map(hash).join(' ')}`, "connect-src 'self'", `frame-src ${FRAME_ORIGINS.join(' ')}`,
    "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
}
