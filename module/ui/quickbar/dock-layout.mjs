import { groupForDock } from "./quickbar-layout.mjs";

/**
 * Arrange already-built quick-bar pieces into the Dock style: leading
 * non-button nodes (pending / clinch label / held indicator) first, then the
 * `.qb-btn` buttons wrapped into labelled segments in canonical group order.
 * The buttons keep their wiring hooks; only their DOM parent changes.
 *
 * @param {HTMLElement} rootEl  the quickbar root (already class-toggled to dock)
 * @param {Node[]} pieces       mixed indicator nodes + button elements
 */
export function applyDockLayout(rootEl, pieces) {
  const leading = pieces.filter(n => !(n instanceof HTMLElement) || !n.classList.contains("qb-btn"));
  const buttons = pieces.filter(n => n instanceof HTMLElement && n.classList.contains("qb-btn"));

  const descriptors = buttons.map(btn => ({
    key:   btn.dataset.qbKey ?? "",
    group: btn.dataset.qbGroup ?? "utility",
    btn,
  }));
  const segments = groupForDock(descriptors);

  const children = [...leading];
  segments.forEach((seg, i) => {
    if (i > 0) {
      const div = document.createElement("span");
      div.className = "qb-div";
      children.push(div);
    }
    const segEl = document.createElement("div");
    segEl.className = `qb-seg qb-seg-${seg.group}`;
    const label = document.createElement("span");
    label.className = "qb-seg-label";
    label.textContent = game.i18n.localize(`EX2E.QbGroup${_cap(seg.group)}`);
    segEl.appendChild(label);
    for (const item of seg.items) segEl.appendChild(item.btn);
    children.push(segEl);
  });

  rootEl.replaceChildren(...children);
}

const _cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
