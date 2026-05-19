/**
 * Refresh the fill and disabled state of a pip track.
 * @param {HTMLElement}      track      - `.exc-pip-track` container
 * @param {HTMLInputElement} hidden     - hidden value input inside the track
 * @param {number}           allowedMax - highest pip index that may be enabled
 * @param {boolean}          [enabled=true] - false disables all pips (e.g. third-exc active)
 */
export function refreshPips(track, hidden, allowedMax, enabled = true) {
  if (!track) return;
  const current = parseInt(hidden?.value) || 0;
  track.querySelectorAll(".exc-pip").forEach(pip => {
    const v = parseInt(pip.dataset.value);
    pip.classList.toggle("is-filled", enabled && v <= current);
    pip.disabled = !enabled || v > allowedMax;
  });
}
