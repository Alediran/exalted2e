import { register, sweep }     from "../_helpers/cleanup.mjs";
import { assertTestWorld }       from "../_helpers/world.mjs";
import { createTempCharacter }   from "../_helpers/actors.mjs";
import { _resolveActOfVillainy } from "../../../module/exalted2e.mjs";

async function makeInfernal({ name, compassion = 3, conviction = 4, torment = 7 } = {}) {
  const actor = await createTempCharacter({ name });
  await actor.update({
    "system.exaltType":                  "infernal",
    "system.virtues.compassion.value":   compassion,
    "system.virtues.conviction.value":   conviction,
    "system.limit":                      torment,
  });
  return actor;
}

async function makeAovMessage(actor, { pool, stunt = 0 } = {}) {
  const selectedVirtues = [
    { key: "compassion", label: "EX2E.VirtueCompassion", value: actor.system.virtues.compassion.value },
    { key: "conviction", label: "EX2E.VirtueConviction", value: actor.system.virtues.conviction.value },
  ];
  const msg = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: "",
    flags: {
      exalted2e: {
        actOfVillainy: {
          actorId: actor.id,
          actorName: actor.name,
          pool:  pool ?? selectedVirtues.reduce((s, v) => s + v.value, 0),
          stunt,
          selectedVirtues,
          rolled: false,
        }
      }
    }
  });
  register(msg);
  return msg;
}

export function registerActOfVillainy(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Act of Villainy roll", () => {
    before(() => assertTestWorld());
    afterEach(() => sweep());

    it("[171] _resolveActOfVillainy decrements Torment by success count", async () => {
      const actor = await makeInfernal({ name: "Q-AoV-Basic", torment: 7 });
      const msg   = await makeAovMessage(actor, { pool: 7 });
      await _resolveActOfVillainy(msg, 3);
      assert.equal(actor.system.limit, 4, "Torment 7 − 3 successes = 4");
    });

    it("[172] _resolveActOfVillainy clamps Torment at 0 when successes exceed current value", async () => {
      const actor = await makeInfernal({ name: "Q-AoV-Clamp", torment: 2 });
      const msg   = await makeAovMessage(actor, { pool: 7 });
      await _resolveActOfVillainy(msg, 5);
      assert.equal(actor.system.limit, 0, "Torment cannot go below 0");
    });

    it("[173] _resolveActOfVillainy marks the message rolled:true", async () => {
      const actor = await makeInfernal({ name: "Q-AoV-Flag", torment: 5 });
      const msg   = await makeAovMessage(actor, { pool: 7 });
      await _resolveActOfVillainy(msg, 2);
      assert.equal(msg.flags?.exalted2e?.actOfVillainy?.rolled, true, "rolled flag set");
    });

    it("[174] _resolveActOfVillainy is a no-op when already rolled", async () => {
      const actor = await makeInfernal({ name: "Q-AoV-Noop", torment: 6 });
      const msg   = await makeAovMessage(actor, { pool: 7 });
      await msg.update({ flags: { exalted2e: { actOfVillainy: { ...msg.flags.exalted2e.actOfVillainy, rolled: true } } } });
      await _resolveActOfVillainy(msg, 3);
      assert.equal(actor.system.limit, 6, "Torment unchanged when already rolled");
    });

    it("[175] pool stored on the message equals sum of selected virtue permanent values", async () => {
      const actor = await makeInfernal({ name: "Q-AoV-Pool", compassion: 3, conviction: 4, torment: 5 });
      const msg   = await makeAovMessage(actor);
      const aov   = msg.flags?.exalted2e?.actOfVillainy;
      assert.equal(aov.pool, 7, "pool = Compassion(3) + Conviction(4)");
    });
  });
}
