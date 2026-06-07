import { EX2E } from "../config.mjs";
import { CIRCLE_KEY_BY_TRADITION } from "../helpers/spell-helpers.mjs";

/**
 * Compute the cast-button UI state for a given spell item, in the
 * actor's current combat context. Used by:
 *   - SpellSheet's Cast button (item-sheet header)
 *   - CharacterSheet's Charms tab spell-row activate button
 *
 * The two entry points share this logic so the gating, label, and
 * tooltip stay consistent. Returns an object the template renders
 * directly.
 *
 * Decision tree:
 *   1. No actor                              → { visible: false }
 *   2. Initiation < spell.circle             → disabled + initiation tooltip
 *   3. Multi-tick = non-sorcery (e.g. aim)   → disabled + busy-other tooltip
 *   4. Multi-tick = sorcery, different spell → disabled + busy-shaping tooltip
 *   5. Multi-tick = sorcery, this spell, ready-to-cast → enabled + "Release {spell}"
 *   6. Multi-tick = sorcery, this spell, mid-shape     → enabled + "Continue shaping (k/total)"
 *   7. Insufficient motes                    → disabled + motes tooltip
 *   8. Insufficient willpower                → disabled + WP tooltip
 *   9. Otherwise                             → enabled + plain "Cast"
 *
 * @param {object} item — Foundry Item document of type "spell"
 * @returns {{visible: boolean, enabled?: boolean, label?: string, tooltip?: string}}
 */
export function computeSpellCastButtonState(item) {
  const actor = item?.actor;
  if (!actor) return { visible: false };

  const sys = item.system;
  const combatants = (game.combats?.contents ?? []).flatMap(c => c.combatants?.contents ?? []);
  const combatant  = combatants.find(c => c.actorId === actor.id) ?? null;
  const action     = combatant?.flags?.exalted2e?.multiTickAction ?? null;

  // 2. Initiation gate.
  const tradition  = sys.tradition ?? "sorcery";
  const initiation = actor.system?.[tradition]?.initiation ?? 0;
  const circle     = sys.circle ?? 1;
  if (initiation < circle) {
    const circleKey = CIRCLE_KEY_BY_TRADITION[tradition]?.[circle] ?? "EX2E.CircleTerrestrial";
    return {
      visible: true,
      enabled: false,
      label:   game.i18n.localize("EX2E.SpellCastButton"),
      tooltip: game.i18n.format("EX2E.SpellCastCantInitiation", {
        circle: game.i18n.localize(circleKey)
      })
    };
  }

  // 2b. Clarity gate — weaving only.
  if (tradition === "weaving") {
    const clarity    = actor.system?.splat?.alchemical?.clarity?.total ?? 0;
    const minClarity = sys.minimumClarity ?? 0;
    if (clarity < minClarity) {
      return {
        visible: true,
        enabled: false,
        label:   game.i18n.localize("EX2E.SpellCastButton"),
        tooltip: game.i18n.format("EX2E.SpellCastCantClarity", {
          need: minClarity,
          have: clarity
        })
      };
    }
  }

  // 3. Multi-tick — busy with non-sorcery (e.g., aim). Localize the
  // action name via EX2E.actions registry rather than exposing the raw
  // internal actionKey to the player.
  if (action && action.actionKey !== "sorcery") {
    const actionLabelKey = EX2E.actions?.[action.actionKey]?.labelKey;
    const actionName = actionLabelKey
      ? game.i18n.localize(actionLabelKey)
      : action.actionKey;
    return {
      visible: true,
      enabled: false,
      label:   game.i18n.localize("EX2E.SpellCastButton"),
      tooltip: game.i18n.format("EX2E.SpellCastBusyOther", {
        actionKey: actionName
      })
    };
  }

  // 4. Multi-tick — sorcery for a different spell.
  if (action && action.actionKey === "sorcery"
      && action.state?.spellId !== item.id) {
    return {
      visible: true,
      enabled: false,
      label:   game.i18n.localize("EX2E.SpellCastButton"),
      tooltip: game.i18n.format("EX2E.SpellCastBusyShaping", {
        spell: action.state?.spellName ?? ""
      })
    };
  }

  // 5. Multi-tick — sorcery for THIS spell, completed === total.
  if (action && action.actionKey === "sorcery"
      && action.state?.spellId === item.id
      && (action.state?.completedShapeActions ?? 0) === (action.state?.totalShapeActions ?? 0)) {
    return {
      visible: true,
      enabled: true,
      label:   game.i18n.format("EX2E.SpellCastReleaseLabel", {
        spell: item.name
      }),
      tooltip: ""
    };
  }

  // 6. Multi-tick — sorcery for THIS spell, mid-shape.
  if (action && action.actionKey === "sorcery"
      && action.state?.spellId === item.id) {
    const completed = (action.state?.completedShapeActions ?? 0) + 1;
    const total     = action.state?.totalShapeActions ?? 0;
    return {
      visible: true,
      enabled: true,
      label:   game.i18n.format("EX2E.SpellCastShapingBtn",
                                { k: completed, total }),
      tooltip: ""
    };
  }

  // 7. Insufficient motes.
  const motesCost  = sys.cost?.motes ?? 0;
  const peripheral = actor.system?.motes?.peripheral?.value ?? 0;
  const personal   = actor.system?.motes?.personal?.value ?? 0;
  if (peripheral + personal < motesCost) {
    return {
      visible: true,
      enabled: false,
      label:   game.i18n.localize("EX2E.SpellCastButton"),
      tooltip: game.i18n.format("EX2E.SpellCastCantMotes", {
        need: motesCost,
        have: peripheral + personal
      })
    };
  }

  // 8. Insufficient willpower.
  const wpCost = sys.cost?.willpower ?? 0;
  const wp     = actor.system?.willpower?.value ?? 0;
  if (wp < wpCost) {
    return {
      visible: true,
      enabled: false,
      label:   game.i18n.localize("EX2E.SpellCastButton"),
      tooltip: game.i18n.format("EX2E.SpellCastCantWillpower", {
        need: wpCost,
        have: wp
      })
    };
  }

  // 9. Default — enabled, no tooltip.
  return {
    visible: true,
    enabled: true,
    label:   game.i18n.localize("EX2E.SpellCastButton"),
    tooltip: ""
  };
}
