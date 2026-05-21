import { describe, it, expect, vi } from "vitest";
import {
  initialRemainingActions,
  clearSceneCharms,
  decrementActionCharmsFor,
} from "../../module/helpers/charm-deactivation.mjs";

function makeActor(effectList) {
  return {
    effects: effectList,
    deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
    updateEmbeddedDocuments: vi.fn().mockResolvedValue([]),
  };
}

function ae(id, charmDuration, remainingActions) {
  const flags = { exalted2e: { charmDuration } };
  if (remainingActions !== undefined) flags.exalted2e.remainingActions = remainingActions;
  return { id, flags };
}

describe("initialRemainingActions", () => {
  it("returns 1 for untilNextAction", () =>
    expect(initialRemainingActions("untilNextAction")).toBe(1));
  it("returns 1 for oneAction", () =>
    expect(initialRemainingActions("oneAction")).toBe(1));
  it("returns 2 for twoActions", () =>
    expect(initialRemainingActions("twoActions")).toBe(2));
  it("returns 3 for threeActions", () =>
    expect(initialRemainingActions("threeActions")).toBe(3));
  it("returns null for oneScene", () =>
    expect(initialRemainingActions("oneScene")).toBeNull());
  it("returns null for indefinite", () =>
    expect(initialRemainingActions("indefinite")).toBeNull());
  it("returns null for permanent", () =>
    expect(initialRemainingActions("permanent")).toBeNull());
});

describe("clearSceneCharms", () => {
  it("deletes AEs with oneScene duration", async () => {
    const actor = makeActor([ae("a1", "oneScene"), ae("a2", "indefinite")]);
    await clearSceneCharms(actor);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", ["a1"]);
  });

  it("deletes AEs with all action-count durations", async () => {
    const actor = makeActor([
      ae("a1", "untilNextAction"),
      ae("a2", "oneAction"),
      ae("a3", "twoActions"),
      ae("a4", "threeActions"),
    ]);
    await clearSceneCharms(actor);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith(
      "ActiveEffect",
      ["a1", "a2", "a3", "a4"]
    );
  });

  it("does not delete indefinite or permanent AEs", async () => {
    const actor = makeActor([ae("a1", "indefinite"), ae("a2", "permanent")]);
    await clearSceneCharms(actor);
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("is a no-op for null actor", async () => {
    await expect(clearSceneCharms(null)).resolves.toBeUndefined();
  });
});

describe("decrementActionCharmsFor", () => {
  it("updates AEs with remainingActions > 1", async () => {
    const actor = makeActor([ae("a1", "twoActions", 2)]);
    await decrementActionCharmsFor(actor);
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
      { _id: "a1", "flags.exalted2e.remainingActions": 1 },
    ]);
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("deletes AEs when remainingActions reaches zero", async () => {
    const actor = makeActor([ae("a1", "oneAction", 1)]);
    await decrementActionCharmsFor(actor);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", ["a1"]);
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("treats missing remainingActions as 1 and deletes on first decrement", async () => {
    const actor = makeActor([ae("a1", "untilNextAction")]);
    await decrementActionCharmsFor(actor);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", ["a1"]);
  });

  it("ignores oneScene AEs", async () => {
    const actor = makeActor([ae("a1", "oneScene"), ae("a2", "twoActions", 2)]);
    await decrementActionCharmsFor(actor);
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
      { _id: "a2", "flags.exalted2e.remainingActions": 1 },
    ]);
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("is a no-op when no action-count AEs exist", async () => {
    const actor = makeActor([ae("a1", "indefinite")]);
    await decrementActionCharmsFor(actor);
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
