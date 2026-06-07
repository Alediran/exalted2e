/**
 * New value for a clicked dot-rating pip. The first pip toggles to `min` only
 * when the track is already at 1; any other click sets that pip's value
 * (floored at min).
 */
export function resolveNewDotValue(clicked, current, min) {
  return (clicked === 1 && current === 1) ? min : Math.max(min, clicked);
}
