// Entering a world: while a project or work entry is the current row, the sky's palette fades to that
// world's colours (computed by the build, shipped as #worlds JSON); other rows bring back the page's own.
// Rows that share colours share a world, so moving between them changes nothing.

/**
 * @param {Document} doc
 * @param {{ tint(base: string, accent: string): void } | null} sky
 * @param {{ base: string, accent: string }} home the page's own sky colours
 * @returns {null | { readonly hash: string | null }}
 */
export function startWorld(doc, sky, home) {
  const data = doc.getElementById('worlds');
  if (!data || !sky) return null;
  const byHash = new Map();
  for (const w of JSON.parse(data.textContent)) for (const h of w.hashes) byHash.set(h, w);
  let hash = null;
  doc.addEventListener('graph:current', (e) => {
    hash = e.detail?.hash ?? null;
    const w = byHash.get(hash) || home;
    sky.tint(w.base, w.accent);
  });
  return { get hash() { return hash; } };
}
