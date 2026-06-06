import { sweep }              from "../_helpers/cleanup.mjs";
import { assertTestWorld }    from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { placeToken }          from "../_helpers/scenes.mjs";
import { startTempCombat }     from "../_helpers/combat.mjs";
import { applyMassGuard }      from "../../../module/combat/mass-guard.mjs";

export function registerMassGuard(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Mass Guard", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[161] guards selected combatants, skips non-combatants, posts one card", async () => {
      const scene = game.scenes.active;
      const a1 = await createTempCharacter({ name: "MG-A1" });
      const a2 = await createTempCharacter({ name: "MG-A2" });
      const a3 = await createTempCharacter({ name: "MG-Outsider" });
      const t1 = await placeToken(a1, scene, { x: 100, y: 100 });
      const t2 = await placeToken(a2, scene, { x: 200, y: 100 });
      const t3 = await placeToken(a3, scene, { x: 300, y: 100 });
      const combat = await startTempCombat([a1, a2]); // a3 deliberately NOT in combat

      const before = game.messages.size;
      const res = await applyMassGuard(combat, [t1, t2, t3]);

      assert.equal(res.skipped, 1, "one non-combatant skipped");
      assert.equal(res.guarded.length, 2, "two combatants guarded");
      for (const a of [a1, a2]) {
        const c  = combat.combatants.find(x => x.actorId === a.id);
        const pa = c.flags?.exalted2e?.pendingAction;
        assert.ok(pa, `${a.name} has a pendingAction`);
        assert.equal(pa.actionKey, "guard", "actionKey is guard");
        assert.equal(pa.speed, 3, "guard speed 3");
        assert.equal(pa.abortable, true, "guard is abortable");
      }
      assert.equal(game.messages.size, before + 1, "exactly one combined card posted");
    });

    it("[162] dedupes two tokens of the same actor to one combatant", async () => {
      const scene = game.scenes.active;
      const a1 = await createTempCharacter({ name: "MG-Dedup" });
      const t1 = await placeToken(a1, scene, { x: 100, y: 100 });
      const t2 = await placeToken(a1, scene, { x: 150, y: 100 });
      const combat = await startTempCombat([a1]);

      const res = await applyMassGuard(combat, [t1, t2]);
      assert.equal(res.guarded.length, 1, "shared-actor tokens collapse to one combatant");
      assert.equal(res.skipped, 0, "duplicate token is not counted as skipped");
    });
  });
}
