// Weight budgets: home JS under 25 KB gzipped, fonts under 120 KB.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const FONT = /\.(woff2?|ttf|otf)$/i;

export function measure(outDir) {
  const assets = join(outDir, 'assets');
  const js = existsSync(assets) ? readdirSync(assets).filter((f) => /\.m?js$/.test(f)) : [];
  const homeJsGzip = js.reduce((n, f) => n + gzipSync(readFileSync(join(assets, f)), { level: 9 }).length, 0);
  const fonts = join(outDir, 'fonts');
  const fontsBytes = existsSync(fonts)
    ? readdirSync(fonts).filter((f) => FONT.test(f)).reduce((n, f) => n + statSync(join(fonts, f)).size, 0)
    : 0;
  return { homeJsGzip, fontsBytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const m = measure(process.argv[2] || 'dist');
  console.log(`home js ${(m.homeJsGzip / 1024).toFixed(1)} KB gz (budget 25), fonts ${(m.fontsBytes / 1024).toFixed(1)} KB (budget 120)`);
  if (m.homeJsGzip > 25 * 1024 || m.fontsBytes > 120 * 1024) process.exit(1);
}
