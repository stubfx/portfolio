// The timeline (docs/CONTENT.md §5): inside a `## Timeline` section, each `### YEAR: Title` heading is an entry,
// and a file list renders as a row of cards. YEAR is YYYY, YYYY–YYYY or YYYY– (an en dash, U+2013).
import { inlineText } from './inline.mjs';

export const ENTRY_RE = /^(\d{4}(?:–(?:\d{4})?)?): (.+)$/;

/** @returns {{year: string, title: string} | null} */
export function entry(text) {
  const m = ENTRY_RE.exec(text);
  return m ? { year: m[1], title: m[2] } : null;
}

/** True for each block inside a `## Timeline` section (after that heading, up to the next # or ## heading). */
export function timelineMask(blocks) {
  let inside = false;
  return blocks.map((b) => {
    if (b.type === 'heading' && b.level <= 2) {
      inside = b.level === 2 && inlineText(b.text) === 'Timeline';
      return false;
    }
    return inside;
  });
}
