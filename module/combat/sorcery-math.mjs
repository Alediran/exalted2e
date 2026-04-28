/**
 * Pure helpers for the sorcery shaping pipeline. No Foundry imports.
 *
 * Sorcery uses the multi-tick action container as a sequential-actions
 * consumer (vs. Aim's countdown). The state machine is commit-driven:
 * each Finish-Turn commit fires onCommitOther → planSorceryCommit
 * decides what to do.
 */

const SHAPE_DV_BY_CIRCLE = { 1: 2, 2: 3, 3: 4 };

/**
 * Verify the actor can begin shaping a given spell.
 *
 * Checks initiation in the spell's tradition (sorcery|necromancy).
 * The two tracks are independent per RAW — a character can practice
 * both, advancing each on its own initiation field.
 *
 * @param {object} args
 * @param {object} args.actor — Foundry Actor (or test stub) with system.{sorcery,necromancy}.initiation, system.motes.{peripheral,personal}.value, system.willpower.value
 * @param {object} args.spell — Foundry Item (or test stub) with system.{tradition,circle,cost.{motes,willpower}}
 * @returns {{ok: true}} | {{ok: false, reason: "insufficient-initiation"|"insufficient-motes"|"insufficient-willpower"}}
 */
export function validateCanCast({ actor, spell }) {
  const tradition = spell?.system?.tradition ?? "sorcery";
  const circle    = spell?.system?.circle ?? 1;
  const initiation = actor?.system?.[tradition]?.initiation ?? 0;
  if (initiation < circle) {
    return { ok: false, reason: "insufficient-initiation" };
  }
  const motesCost = spell?.system?.cost?.motes ?? 0;
  const peripheral = actor?.system?.motes?.peripheral?.value ?? 0;
  const personal   = actor?.system?.motes?.personal?.value ?? 0;
  if (peripheral + personal < motesCost) {
    return { ok: false, reason: "insufficient-motes" };
  }
  const wpCost = spell?.system?.cost?.willpower ?? 0;
  const wp = actor?.system?.willpower?.value ?? 0;
  if (wp < wpCost) {
    return { ok: false, reason: "insufficient-willpower" };
  }
  return { ok: true };
}

/**
 * Decide what state transition a commit triggers.
 *
 * @returns {{kind: "continue"}} | {{kind: "cast"}} | {{kind: "interrupt"}} | {{kind: "noop"}}
 */
export function planSorceryCommit({ action, pending, flurry }) {
  const s = action?.state ?? {};
  const sameSpell = pending?.spellId && pending.spellId === s.spellId;
  const completed = s.completedShapeActions ?? 0;
  const total     = s.totalShapeActions ?? 0;

  if (pending?.actionKey === "sorceryShape" && sameSpell && completed < total) {
    return { kind: "continue" };
  }
  if (pending?.actionKey === "sorceryCast" && sameSpell && completed === total) {
    return { kind: "cast" };
  }
  if (pending) {
    return { kind: "interrupt" };
  }
  if (flurry) {
    return { kind: "interrupt" };
  }
  return { kind: "noop" };
}

/**
 * Build the pendingAction payload for a fresh shape (action 1 of N).
 *
 * Returns label as an i18n key reference (not a localized string) so
 * tests don't need i18n shims; the caller localizes via game.i18n.format.
 */
export function buildShapeDeclaration({ spell }) {
  const circle = spell?.system?.circle ?? 1;
  return {
    actionKey: "sorceryShape",
    spellId:   spell?.id ?? "",
    labelKey:  "EX2E.SpellCastShapingLabel",
    labelArgs: { spell: spell?.name ?? "" },
    speed:     5,
    dvPenalty: SHAPE_DV_BY_CIRCLE[circle] ?? 2,
    abortable: true
  };
}

/**
 * Build the pendingAction payload for a continuation shape (actions 2..N).
 */
export function buildContinueShapeDeclaration({ action }) {
  const s = action?.state ?? {};
  const circle = s.circle ?? 1;
  return {
    actionKey: "sorceryShape",
    spellId:   s.spellId ?? "",
    labelKey:  "EX2E.SpellCastShapingLabel",
    labelArgs: { spell: s.spellName ?? "" },
    speed:     5,
    dvPenalty: SHAPE_DV_BY_CIRCLE[circle] ?? 2,
    abortable: true
  };
}

/**
 * Build the pendingAction payload for the final Cast Sorcery action.
 */
export function buildCastDeclaration({ action }) {
  const s = action?.state ?? {};
  return {
    actionKey: "sorceryCast",
    spellId:   s.spellId ?? "",
    labelKey:  "EX2E.SpellCastReleaseLabel",
    labelArgs: { spell: s.spellName ?? "" },
    speed:     5,
    dvPenalty: 0,
    abortable: false
  };
}
