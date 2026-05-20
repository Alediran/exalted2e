import { assertTestWorld } from "../_helpers/world.mjs";

export function registerCoordinationTests(context) {
  const { describe, it, assert, before, after } = context;

  let coordinator, target;

  before(assertTestWorld);

  before(async () => {
    coordinator = await Actor.create({ name: "QCoordinator", type: "character" });
    target      = await Actor.create({ name: "QTarget",      type: "character" });
  });

  after(async () => {
    await coordinator?.delete();
    await target?.delete();
  });

  describe("coordination AE expiry", () => {
    it("AE with expiry.tick=5 persists while newTick=5", async () => {
      const ae = await target.createEmbeddedDocuments("ActiveEffect", [{
        name: "Test Coordination",
        flags: {
          exalted2e: {
            dvPenalty:          { type: "both", value: 2 },
            dvRefreshable:      false,
            coordinationExpiry: { tick: 5 }
          }
        }
      }]);
      // Simulate the cleanup predicate with newTick = 5 (5 < 5 is false → AE stays)
      const newTick = 5;
      const toDelete = [];
      for (const a of game.actors) {
        for (const ef of a.effects) {
          const expiry = ef.flags?.exalted2e?.coordinationExpiry;
          if (expiry && expiry.tick < newTick) toDelete.push({ actor: a, aeId: ef.id });
        }
      }
      assert.isFalse(toDelete.some(x => x.aeId === ae[0].id),
        "AE with tick=5 should survive when newTick=5");
      await ae[0].delete();
    });

    it("AE with expiry.tick=4 is removed when newTick=5", async () => {
      await target.createEmbeddedDocuments("ActiveEffect", [{
        name: "Test Coordination Expired",
        flags: {
          exalted2e: {
            dvPenalty:          { type: "both", value: 2 },
            dvRefreshable:      false,
            coordinationExpiry: { tick: 4 }
          }
        }
      }]);
      const sizeBefore = target.effects.size;
      // Simulate the cleanup loop with newTick = 5
      const newTick = 5;
      const toDelete = [];
      for (const ef of target.effects) {
        const expiry = ef.flags?.exalted2e?.coordinationExpiry;
        if (expiry && expiry.tick < newTick) toDelete.push(ef.id);
      }
      await target.deleteEmbeddedDocuments("ActiveEffect", toDelete);
      assert.equal(target.effects.size, sizeBefore - 1, "Expired AE should be removed");
    });
  });
}
