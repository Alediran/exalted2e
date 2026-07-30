import { describe, it, expect } from "vitest";
import { makeCharacterSystem, makeNpcSystem } from "../_helpers/make-actor.mjs";

describe("Foundry mock fixture", () => {
  it("installs game, Hooks, ChatMessage, ui, foundry globals", () => {
    expect(globalThis.game).toBeDefined();
    expect(globalThis.Hooks).toBeDefined();
    expect(globalThis.ChatMessage).toBeDefined();
    expect(globalThis.ui).toBeDefined();
    expect(globalThis.foundry).toBeDefined();
    expect(globalThis.foundry.data.fields.SchemaField).toBeDefined();
  });

  it("makeCharacterSystem returns a valid Solar default", () => {
    const sys = makeCharacterSystem();
    expect(sys.exaltType).toBe("solar");
    expect(sys.attributes.dexterity.value).toBe(1);
    expect(sys.virtues.compassion.value).toBe(1);
    expect(sys.willpower.max).toBe(10);
    expect(sys.splat.lunar.tell).toBe("");
  });

  it("makeNpcSystem returns a valid mortal NPC default", () => {
    const sys = makeNpcSystem();
    expect(sys.npcType).toBe("mortal");
    expect(sys.combat.dodgeMDV).toBe(2);
    expect(sys.health.levels).toBeDefined();
    expect(sys.health.levels.zero + sys.health.levels.one + sys.health.levels.two + sys.health.levels.four + 1).toBe(7);
  });
});
