// Pure logic for the git graph in the gutter.

/** Focus follows the current commit; the previous non-main focus lingers as a ghost. */
export function focusReducer(state, next) {
  if (next === state.focus) return state;
  const prev = state.focus;
  if (prev !== 'main' && prev !== next) return { focus: next, ghost: prev };
  return { focus: next, ghost: state.ghost === next ? null : state.ghost };
}

/** Where a branch should sit: lane 1 (focus), lane 2 (ghost) or hidden. */
export function laneTarget(name, { focus, ghost }, narrow) {
  if (name === focus) return { lane: 1, opacity: 1, draw: 1 };
  if (name === ghost && (!narrow || focus === 'main')) return { lane: focus === 'main' ? 1 : 2, opacity: 0.3, draw: 1 };
  return { lane: 0, opacity: 0, draw: 0 };
}

const n = (v) => +v.toFixed(2);

/** SVG path for a branch: leaves the rail at the merge row (or the top), returns at the fork row. */
export function branchPath({ mY, fY, top }, x, x0, r = 20) {
  const head = mY !== null && mY !== undefined
    ? `M${n(x0)} ${n(mY)}C${n(x0)} ${n(mY + r * 0.55)} ${n(x)} ${n(mY + r * 0.45)} ${n(x)} ${n(mY + r)}`
    : `M${n(x)} ${n(top)}`;
  return `${head}V${n(fY - r)}C${n(x)} ${n(fY - r * 0.45)} ${n(x0)} ${n(fY - r * 0.55)} ${n(x0)} ${n(fY)}`;
}

/**
 * Index of the current row: the last whose y is at or above `line`,
 * the last row when the page is scrolled to the bottom, or a dwelling cover.
 */
export function pickCurrent(ys, line, atBottom, dwellIndex) {
  if (dwellIndex >= 0) return dwellIndex;
  if (atBottom) return ys.length - 1;
  let cur = 0;
  ys.forEach((y, i) => { if (y <= line) cur = i; });
  return cur;
}
