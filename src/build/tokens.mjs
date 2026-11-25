// Catppuccin Mocha plus the crema accent and one colour per branch.
// tokens.css mirrors this object; a test keeps them in sync.
import { contrastRatio } from './contrast.mjs';

export const TOKENS = {
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  text: '#cdd6f4',
  sub: '#a6adc8',
  line: '#313244',
  tick: '#6c7086',
  mauve: '#cba6f7',
  crema: '#d4a77a',
  'b-main': '#cdd6f4',
  'b-ibm': '#89b4fa',
  'b-accenture': '#cba6f7',
  'b-school': '#fab387',
  'b-twitch': '#f38ba8',
  'b-mods': '#94e2d5',
};

const MIN = { AAA: 7, AA: 4.5, graphics: 3 };

export const CONTRAST_CHECKS = [
  { what: 'Body text', fg: TOKENS.text, rule: 'AAA' },
  { what: 'Labels and HUD', fg: TOKENS.sub, rule: 'AA' },
  { what: 'Git refs', fg: TOKENS.crema, rule: 'AA' },
  { what: 'Cursor and links', fg: TOKENS.mauve, rule: 'AA' },
  { what: 'Branch: main', fg: TOKENS['b-main'], rule: 'graphics' },
  { what: 'Branch: IBM', fg: TOKENS['b-ibm'], rule: 'graphics' },
  { what: 'Branch: Accenture', fg: TOKENS['b-accenture'], rule: 'graphics' },
  { what: 'Branch: art school', fg: TOKENS['b-school'], rule: 'graphics' },
  { what: 'Branch: Twitch', fg: TOKENS['b-twitch'], rule: 'graphics' },
  { what: 'Branch: mods', fg: TOKENS['b-mods'], rule: 'graphics' },
];

export function contrastTable() {
  return CONTRAST_CHECKS.map(({ what, fg, rule }) => {
    const onBase = contrastRatio(fg, TOKENS.base);
    const onBlack = contrastRatio(fg, '#000000');
    return { what, fg, rule, onBase, onBlack, pass: Math.min(onBase, onBlack) >= MIN[rule] };
  });
}
