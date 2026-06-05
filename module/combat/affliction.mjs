import { ExaltedRoll } from "../rolls/exalted-roll.mjs";
import { parseAfflictionDamage, poisonNetDamage } from "./affliction-math.mjs";

function _resPool(actor) {
  return Math.max(1, (actor.system.attributes?.stamina?.value ?? 0) + (actor.system.abilities?.resistance?.value ?? 0));
}

async function _card(actor, title, lines, warning = "") {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/affliction-card.hbs",
    { actorName: actor?.name ?? "", title, lines, warning }
  );
  await ChatMessage.create({ content, speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined });
}

/** Create the affliction AE on each target. `item` is a poison or disease Item. */
export async function afflictTargets(item, actors, { intervals = 1 } = {}) {
  const sys = item.system;
  const kind = item.type;
  const affliction = kind === "poison"
    ? {
        kind,
        name: item.name,
        damage: sys.damage,
        damageType: sys.damageType,
        interval: sys.interval,
        duration: sys.duration,
        vector: sys.vector,
        remainingIntervals: Math.max(1, parseInt(intervals) || 1)
      }
    : {
        kind,
        name: item.name,
        morbidity: sys.morbidity,
        trauma: sys.trauma,
        duration: sys.duration,
        vector: sys.vector
      };
  const list = (actors ?? []).filter(Boolean);
  for (const actor of list) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: item.name,
      img:  item.img ?? "icons/svg/poison.svg",
      transfer: false,
      statuses: [ kind === "poison" ? "poison" : "disease" ],
      flags: { exalted2e: { affliction: foundry.utils.deepClone(affliction) } }
    }]);
  }
  if (list.length) {
    await _card(
      list[0],
      game.i18n.format("EX2E.AfflictedTitle", { name: item.name }),
      [ game.i18n.format("EX2E.AfflictedTargets", { targets: list.map(a => a.name).join(", ") }) ]
    );
  }
}

/** Advance one interval. Poison: roll resist, deal net damage, decrement/expire. Disease: resist-to-shake-off. */
export async function advanceAffliction(actor, effectId) {
  const ae = actor.effects.get(effectId);
  const a  = ae?.flags?.exalted2e?.affliction;
  if (!a) return;

  if (a.kind === "poison") {
    const roll = await new ExaltedRoll({
      pool: _resPool(actor),
      actorName: actor.name,
      flavor: game.i18n.localize("EX2E.PoisonResistFlavor")
    }).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });

    let dmgVal = parseAfflictionDamage(a.damage);
    if (dmgVal === 0 && /\dd\d/i.test(a.damage ?? "")) {
      const dr = await new Roll(a.damage).evaluate();
      dmgVal = dr.total;
    }
    const net = poisonNetDamage(dmgVal, roll.successes);
    if (net > 0) await actor.applyDamage(net, a.damageType);

    const left = (a.remainingIntervals ?? 1) - 1;
    const dmgLine = game.i18n.format("EX2E.PoisonTickDamage", { damage: net, type: a.damageType });
    if (left <= 0) {
      await ae.delete();
      await _card(
        actor,
        game.i18n.format("EX2E.AfflictionTitle", { name: a.name }),
        [ dmgLine, game.i18n.localize("EX2E.PoisonExpired") ]
      );
    } else {
      await ae.update({ "flags.exalted2e.affliction.remainingIntervals": left });
      await _card(
        actor,
        game.i18n.format("EX2E.AfflictionTitle", { name: a.name }),
        [ dmgLine, game.i18n.format("EX2E.PoisonIntervalsLeft", { left }) ]
      );
    }
  } else {
    const roll = await new ExaltedRoll({
      pool: _resPool(actor),
      actorName: actor.name,
      flavor: game.i18n.localize("EX2E.DiseaseResistFlavor")
    }).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });

    if (roll.successes >= (a.morbidity ?? 0)) {
      await ae.delete();
      await _card(
        actor,
        game.i18n.format("EX2E.AfflictionTitle", { name: a.name }),
        [ game.i18n.localize("EX2E.DiseaseResisted") ]
      );
    } else {
      const lines = [ game.i18n.localize("EX2E.DiseasePersists") ];
      if (a.trauma) lines.push(game.i18n.format("EX2E.AfflictionTrauma", { trauma: a.trauma }));
      await _card(
        actor,
        game.i18n.format("EX2E.AfflictionTitle", { name: a.name }),
        lines
      );
    }
  }
}

/** Treat with Medicine (both kinds). Healer = first selected token's actor, else the victim. */
export async function treatAffliction(actor, effectId) {
  const ae = actor.effects.get(effectId);
  const a  = ae?.flags?.exalted2e?.affliction;
  if (!a) return;

  const healer = canvas.tokens?.controlled?.[0]?.actor ?? actor;
  const pool = Math.max(1, (healer.system.attributes?.intelligence?.value ?? 0) + (healer.system.abilities?.medicine?.value ?? 0));
  const difficulty = a.kind === "disease" ? (a.morbidity ?? 0) : parseAfflictionDamage(a.damage);

  const roll = await new ExaltedRoll({
    pool,
    actorName: healer.name,
    flavor: game.i18n.localize("EX2E.TreatFlavor")
  }).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: healer }) });

  if (roll.successes >= difficulty) {
    await ae.delete();
    await _card(
      actor,
      game.i18n.format("EX2E.TreatTitle", { name: a.name }),
      [ game.i18n.localize("EX2E.TreatSuccess") ]
    );
  } else {
    await _card(
      actor,
      game.i18n.format("EX2E.TreatTitle", { name: a.name }),
      [ game.i18n.localize("EX2E.TreatFail") ]
    );
  }
}

/** Remove an affliction outright. */
export async function removeAffliction(actor, effectId) {
  const ae = actor.effects.get(effectId);
  if (ae) await ae.delete();
}
