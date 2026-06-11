import { partitionForRadial } from "./quickbar-layout.mjs";

/**
 * Arrange already-built quick-bar pieces into the Bar + Radial style. Leading
 * non-button nodes first; then the bar = Attack + pinned actions + a "More"
 * toggle + Finish. Overflow buttons go into a `.ex2e-action-radial` popover —
 * a CHILD of the root (so `_wire`, which queries the root, still finds them) —
 * arranged on a circle. The More button toggles `.open` on the popover.
 *
 * @param {HTMLElement} rootEl
 * @param {Node[]} pieces
 * @param {string[]} pinnedKeys
 */
export function applyRadialLayout(rootEl, pieces, pinnedKeys) {
  const leading = pieces.filter(n => !(n instanceof HTMLElement) || !n.classList.contains("qb-btn"));
  const buttons = pieces.filter(n => n instanceof HTMLElement && n.classList.contains("qb-btn"));

  const descriptors = buttons.map(btn => ({ key: btn.dataset.qbKey ?? "", btn }));
  const { bar, radial } = partitionForRadial(descriptors, pinnedKeys);

  // Keep Finish last in the bar regardless of input order.
  const finish = bar.filter(d => d.key === "finish");
  const barRest = bar.filter(d => d.key !== "finish");

  const children = [...leading, ...barRest.map(d => d.btn)];

  if (radial.length) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "qb-btn qb-more";
    more.innerHTML = `<i class="fa-solid fa-ellipsis"></i> <span class="qb-label">${game.i18n.localize("EX2E.ActionBarMore")}</span>`;

    const pop = document.createElement("div");
    pop.className = "ex2e-action-radial";
    const n = radial.length;
    // Scale the arc radius with the count so the icon nodes never bunch up:
    // ~14px of arc-radius per node, floored so a small overflow still fans out.
    pop.style.setProperty("--qb-radial-radius", `${Math.max(96, n * 14)}px`);
    radial.forEach((d, i) => {
      // Spread around a 180° arc fanning upward from the More button.
      const angle = n === 1 ? -90 : -180 + (i * 180) / (n - 1);
      d.btn.style.setProperty("--qb-radial-angle", `${angle}deg`);
      pop.appendChild(d.btn);
    });

    more.addEventListener("click", (ev) => {
      ev.stopPropagation();
      pop.classList.toggle("open");
    });

    children.push(more, pop);
  }

  children.push(...finish.map(d => d.btn));
  rootEl.replaceChildren(...children);
}
