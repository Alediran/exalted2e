/**
 * Pure builder for the scene-duration ActiveEffect stamped when a character's
 * Virtue-Flaw drives a Limit Break. Foundry-free so it is unit-testable.
 *
 * @param {object} virtueFlaw  The virtueflaw item (needs `id`, `img`, `system.baseVirtue`, `system.changes`).
 * @param {string} name        Pre-localized AE name (e.g. "Compassion — Limit Break").
 * @returns {object}           ActiveEffect creation data for createEmbeddedDocuments.
 */
export function buildLimitBreakEffectData(virtueFlaw, name) {
  const changes = (virtueFlaw.system?.changes ?? [])
    .filter(c => c.key)
    .map(c => ({ key: c.key, mode: c.mode, value: c.value }));

  return {
    name,
    img: virtueFlaw.img || "icons/svg/terror.svg",
    changes,
    transfer: false,
    flags: {
      exalted2e: {
        limitBreakEffect: {
          virtueFlawId: virtueFlaw.id,
          baseVirtue:   virtueFlaw.system?.baseVirtue,
        },
        charmDuration: "oneScene",
        gmOnlyRemoval: true,
      },
    },
  };
}
