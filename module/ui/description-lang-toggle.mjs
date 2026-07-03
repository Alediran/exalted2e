/**
 * One document-level delegated listener: when a description-language <select>
 * changes, show only the matching editor within its container. Registered once;
 * works for every item sheet — no per-sheet wiring.
 */
export function wireDescriptionLangToggle() {
  document.addEventListener("change", (ev) => {
    const select = ev.target?.closest?.(".ex2e-desc-lang-select");
    if (!select) return;
    const container = select.closest(".ex2e-desc-langs");
    if (!container) return;
    const chosen = select.value;
    for (const ed of container.querySelectorAll(".ex2e-desc-editor")) {
      ed.toggleAttribute("hidden", ed.dataset.lang !== chosen);
    }
  });
}
