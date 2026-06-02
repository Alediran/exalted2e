import { ExaltedRoll }           from "./exalted-roll.mjs";
import { evaluateCharmFormula }  from "../documents/item.mjs";
import { pickTargetActor }       from "../helpers/targeting.mjs";

/**
 * Full attack pipeline for spells with spellAttack.enabled === true.
 *
 * Flow:
 *   1. Evaluate pool formula against actor's rollData
 *   2. Resolve target
 *   3. Prompt for stunt level + DV type (Dodge / Parry)
 *   4. Roll dice pool
 *   5. Compare successes to target DV
 *   6. If hit: evaluate damage formula with @successes = excess, roll damage
 *   7. Post spell-attack-result chat card
 *
 * @param {object} actor  - Foundry Actor (must be type "character" or "npc")
 * @param {object} spell  - Foundry Item of type "spell"
 */
export async function rollSpellAttack(actor, spell) {
  if (!actor || !spell) return;
  const sys = spell.system;
  if (!sys?.spellAttack?.enabled) return;

  const sa = sys.spellAttack;

  // ── 1. Build roll data and evaluate pool ──────────────────────────────
  const rollData  = actor.getRollData?.() ?? {};
  const basePool  = evaluateCharmFormula(sa.pool, rollData, 0);
  const totalPool = Math.max(1, basePool + (sa.accuracy ?? 0));

  // ── 2. Resolve targets ────────────────────────────────────────────────
  // AoE spells use placeAreaTemplate to paint a shape on the canvas and
  // collect all tokens inside it. Single-target spells use the first
  // selected token or prompt with the canvas picker.
  const isAoe = !!(sa.area?.enabled);
  let targets  = [];

  if (isAoe) {
    const { placeAreaTemplate } = await import("../helpers/targeting.mjs");
    const sizeVal   = evaluateCharmFormula(String(sa.area?.size ?? "5"), rollData, 5);
    const placement = await placeAreaTemplate(actor, {
      shape: sa.area?.shape ?? "circle",
      size:  String(sizeVal),
    });
    if (!placement) return; // user cancelled placement
    targets = (placement.targets ?? []).filter(Boolean);
  } else {
    const t = game.user.targets.first()?.actor ?? await pickTargetActor();
    if (t) targets = [t];
  }

  const hasTargets = targets.length > 0;

  // ── 3. Stunt + DV-type dialog ─────────────────────────────────────────
  const stuntOpts = [0,1,2,3].map(n =>
    `<option value="${n}">${n} — ${game.i18n.localize("EX2E.Stunt")} ${n}</option>`
  ).join("");
  const dialogResult = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("EX2E.SpellAttackStuntTitle", { spell: spell.name }) },
    content: `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.Stunt")}</label>
  <select name="stunt" style="flex:1">${stuntOpts}</select>
</div>
${hasTargets ? `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellAttackDVTypeLabel")}</label>
  <select name="dvType" style="flex:1">
    <option value="dodge">${game.i18n.localize("EX2E.DodgeDV")}</option>
    <option value="parry">${game.i18n.localize("EX2E.ParryDV")}</option>
  </select>
</div>` : ""}`,
    ok: {
      label: game.i18n.localize("EX2E.Roll"),
      callback: (_ev, button) => ({
        stunt:  parseInt(button.form.elements.stunt?.value)  || 0,
        dvType: button.form.elements.dvType?.value           || "dodge",
      })
    }
  });
  if (!dialogResult) return;
  const { stunt, dvType } = dialogResult;

  // ── 4. Roll ───────────────────────────────────────────────────────────
  const roll = await new ExaltedRoll({
    pool:      totalPool,
    stunt,
    actorName: actor.name,
    flavor:    spell.name,
  }).evaluate();
  const successes = roll.successes;

  // ── 5+6. Per-target DV comparison + damage ────────────────────────────
  const damageTypeKey = sa.damageType === "aggravated" ? "EX2E.DamageAggravated"
                      : sa.damageType === "lethal"     ? "EX2E.DamageLethal"
                      : "EX2E.DamageBashing";
  const damageTypeLabel = game.i18n.localize(damageTypeKey);

  const targetResults = [];
  for (const t of targets) {
    const hitDV  = dvType === "parry" ? (t.currentParryDV ?? 0) : (t.currentDodgeDV ?? 0);
    const hit    = successes > hitDV;
    const excess = hit ? successes - hitDV : 0;
    let damageSuccesses = null;
    if (hit) {
      const dmgRollData = { ...rollData, successes: excess };
      const damagePool  = Math.max(1,
        evaluateCharmFormula(sa.damage, dmgRollData, 0) + (sa.overwhelming ?? 0)
      );
      const damageRoll  = await new ExaltedRoll({ pool: damagePool }).evaluate();
      damageSuccesses   = damageRoll.successes;
    }
    targetResults.push({ targetName: t.name, hit, hitDV, damageSuccesses });
  }

  // Legacy single-target fields for the no-target case
  const singleResult = targetResults[0] ?? null;

  // ── 7. Area info ──────────────────────────────────────────────────────
  let areaLabel = null;
  if (isAoe && sa.area) {
    const shapeKey = `EX2E.AreaShape${sa.area.shape.charAt(0).toUpperCase()}${sa.area.shape.slice(1)}`;
    const displaySize = evaluateCharmFormula(String(sa.area.size ?? "5"), rollData, 5);
    areaLabel = `${game.i18n.localize(shapeKey)} — ${displaySize} ${game.i18n.localize("EX2E.SpellAttackAreaYards")}`;
  }

  // ── 8. Post chat card ─────────────────────────────────────────────────
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/spell-attack-result.hbs",
    {
      actorName:      actor.name,
      spellName:      spell.name,
      pool:           totalPool + stunt,
      successes,
      areaLabel,
      isAoe,
      targetResults,
      // Single-target convenience fields (used when !isAoe && 1 target)
      targetName:     singleResult?.targetName ?? null,
      hit:            singleResult?.hit        ?? null,
      hitDV:          singleResult?.hitDV      ?? null,
      damageSuccesses:singleResult?.damageSuccesses ?? null,
      damageTypeLabel,
      ignoresArmor:   sa.ignoresArmor,
    }
  );

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
  });
}
