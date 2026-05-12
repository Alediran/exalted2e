import { evaluateCharmFormula } from "../documents/item.mjs";

/**
 * Synthesize Foundry AE data objects from charm system fields.
 * Returns an array of plain objects ready for createEmbeddedDocuments.
 * Skips zero/empty values so no no-op changes are applied.
 *
 * soakBonus.hardnessSetTo is NOT synthesized here — it is non-additive
 * (Math.max) and must remain a direct scan in _applyCharmSoak.
 */
export function buildCharmSynthAEs(charm, rollData = {}) {
  const sys = charm.system;
  const changes = [];

  if (sys.soakBonus?.enabled) {
    const { bashing = 0, lethal = 0, aggravated = 0, hardnessAdd = 0,
            bashingFormula, lethalFormula, aggravatedFormula } = sys.soakBonus;
    const ev = (formula, fallback) =>
      formula ? (evaluateCharmFormula(formula, rollData, fallback) ?? fallback) : fallback;
    const b = ev(bashingFormula,    bashing);
    const l = ev(lethalFormula,     lethal);
    const a = ev(aggravatedFormula, aggravated);
    if (b)           changes.push({ key: "system.bonuses.soakBashing",    mode: 2, value: String(b) });
    if (l)           changes.push({ key: "system.bonuses.soakLethal",      mode: 2, value: String(l) });
    if (a)           changes.push({ key: "system.bonuses.soakAggravated",  mode: 2, value: String(a) });
    if (hardnessAdd) changes.push({ key: "system.bonuses.hardnessAdd",     mode: 2, value: String(hardnessAdd) });
  }

  if (sys.woundReduction?.enabled) {
    const formula = sys.woundReduction.formula;
    // formula="" means full negation (covers max wound penalty of -4 in RAW).
    const val = (formula === "" || formula == null) ? 4 : Math.abs(parseInt(formula, 10)) || 0;
    if (val > 0) changes.push({ key: "system.bonuses.woundPenaltyReduction", mode: 2, value: String(val) });
  }

  if (sys.statBoost?.enabled && Array.isArray(sys.statBoost.changes)) {
    for (const ch of sys.statBoost.changes) {
      if (ch.path && parseFloat(ch.value))
        changes.push({ key: ch.path, mode: 2, value: String(ch.value ?? 0) });
    }
  }

  if (!changes.length) return [];

  return [{
    name:     charm.name,
    img:      charm.img ?? "icons/magic/fire/flame-burning-orange.webp",
    changes,
    disabled: false,
    transfer: false,
    flags:    { exalted2e: { charmSource: charm.id } }
  }];
}

/**
 * Copy the charm's embedded ActiveEffects AND synthesized system-field AEs to the actor.
 * Each AE is tagged flags.exalted2e.charmSource = charm.id so
 * _removeCharmWeaponArtifacts can find and delete them precisely.
 */
export async function applyCharmAEs(actor, charm, rollData = {}) {
  if (!actor || !charm) return [];

  const embeddedData = charm.effects.map(effect => {
    const raw = effect.toObject();
    raw.flags ??= {};
    raw.flags.exalted2e ??= {};
    raw.flags.exalted2e.charmSource = charm.id;
    return raw;
  });

  const synthesizedData = buildCharmSynthAEs(charm, rollData);
  const allData = [...embeddedData, ...synthesizedData];
  if (!allData.length) return [];
  return actor.createEmbeddedDocuments("ActiveEffect", allData);
}

/**
 * Deactivate a Form charm: remove its propagated AEs + weapons via the
 * standard _removeCharmWeaponArtifacts path, then clear the active flag.
 */
export async function deactivateForm(charm) {
  if (!charm?.actor) return;
  await charm._removeCharmWeaponArtifacts();
  await charm.update({ "system.active": false });
}

/**
 * Sweep all active Form-type charms on the actor (scene-end path).
 */
export async function clearActorForms(actor) {
  if (!actor) return;
  const activeForms = actor.items.filter(
    i => i.type === "charm"
      && i.system?.keywords?.includes("Form-type")
      && i.system?.active
  );
  for (const form of activeForms) {
    await deactivateForm(form);
  }
}
