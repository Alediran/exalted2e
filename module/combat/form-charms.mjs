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
  const extraFlags = {};

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
    const val = (formula === "" || formula == null) ? 4 : Math.abs(parseInt(formula, 10)) || 0;
    if (val > 0) changes.push({ key: "system.bonuses.woundPenaltyReduction", mode: 2, value: String(val) });
  }

  if (sys.statBoost?.enabled && Array.isArray(sys.statBoost.changes)) {
    for (const ch of sys.statBoost.changes) {
      if (ch.path && parseFloat(ch.value))
        changes.push({ key: ch.path, mode: 2, value: String(ch.value ?? 0) });
    }
  }

  if (sys.dvBonus?.enabled) {
    const dv = sys.dvBonus;
    const ev = (formula, fallback) =>
      formula ? (evaluateCharmFormula(formula, rollData, fallback) ?? fallback) : fallback;
    const dodge = ev(dv.dodgeBonusFormula, dv.dodgeBonus ?? 0);
    const parry = ev(dv.parryBonusFormula, dv.parryBonus ?? 0);
    if (dodge) changes.push({ key: "system.bonuses.dodgeBonus", mode: 2, value: String(dodge) });
    if (parry) changes.push({ key: "system.bonuses.parryBonus", mode: 2, value: String(parry) });
    if (dv.ignoreAllPenalties || (dv.ignorePenaltyTypes ?? []).length > 0) {
      extraFlags.dvBonusIgnore = {
        all:   dv.ignoreAllPenalties ?? false,
        types: dv.ignorePenaltyTypes ?? []
      };
    }
  }

  if (sys.rateBonus?.enabled) {
    const val = sys.rateBonus.formula
      ? (evaluateCharmFormula(sys.rateBonus.formula, rollData, 0) | 0)
      : 0;
    if (val) changes.push({ key: "system.bonuses.rateBonus", mode: 2, value: String(val) });
  }

  if (sys.motePoolBonus?.enabled) {
    const amount = sys.motePoolBonus.amount ?? 0;
    if (amount > 0) {
      const key = sys.motePoolBonus.pool === "personal"
        ? "system.bonuses.motePersonal"
        : "system.bonuses.motePeripheral";
      changes.push({ key, mode: 2, value: String(amount) });
    }
  }

  if (sys.extraActions?.enabled) {
    const max = sys.extraActions.maxFormula
      ? (evaluateCharmFormula(sys.extraActions.maxFormula, rollData, 0) | 0)
      : 0;
    if (max > 0) extraFlags.extraActionsMax = max;
  }

  if (sys.speedModifier?.enabled) {
    const sm = sys.speedModifier;
    const delta = sm.deltaFormula
      ? evaluateCharmFormula(sm.deltaFormula, rollData, sm.delta ?? 0)
      : (sm.delta ?? 0);
    extraFlags.speedModifier = { delta, minimum: sm.minimum ?? 3 };
  }

  if (!changes.length && !Object.keys(extraFlags).length) return [];

  return [{
    name:     charm.name,
    img:      charm.img ?? "icons/magic/fire/flame-burning-orange.webp",
    changes,
    disabled: false,
    transfer: false,
    flags:    { exalted2e: { charmSource: charm.id, ...extraFlags } }
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
