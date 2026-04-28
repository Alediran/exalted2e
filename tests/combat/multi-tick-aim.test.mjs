import { describe, it, expect } from "vitest";
import { aimHandler } from "../../module/combat/multi-tick-aim.mjs";

// Synthetic action object: only the fields onCommitOther reads.
function aimAction(targetActorId = "T") {
  return { actionKey: "aim", state: { targetActorId } };
}

describe("aimHandler.onCommitOther", () => {
  it("no pending and no flurry → keep action, no abort penalty", () => {
    expect(aimHandler.onCommitOther(null, aimAction("T"), null, null))
      .toEqual({ clearAction: false, applyAbortPenalty: false });
  });

  it("pending = aim same target → continuation (keep action, no penalty)", () => {
    const pending = { actionKey: "aim", targetActorId: "T" };
    expect(aimHandler.onCommitOther(null, aimAction("T"), pending, null))
      .toEqual({ clearAction: false, applyAbortPenalty: false });
  });

  it("pending = attack same target → consume aim (clear, no penalty)", () => {
    const pending = { actionKey: "attack", targetActorId: "T" };
    expect(aimHandler.onCommitOther(null, aimAction("T"), pending, null))
      .toEqual({ clearAction: true, applyAbortPenalty: false });
  });

  it("pending = attack different target → divert (clear + penalty)", () => {
    const pending = { actionKey: "attack", targetActorId: "OTHER" };
    expect(aimHandler.onCommitOther(null, aimAction("T"), pending, null))
      .toEqual({ clearAction: true, applyAbortPenalty: true });
  });

  it("pending = guard → divert (clear + penalty)", () => {
    const pending = { actionKey: "guard" };
    expect(aimHandler.onCommitOther(null, aimAction("T"), pending, null))
      .toEqual({ clearAction: true, applyAbortPenalty: true });
  });

  it("flurry truthy with no pending → flurry breaks aim (clear + penalty)", () => {
    expect(aimHandler.onCommitOther(null, aimAction("T"), null, { actions: [] }))
      .toEqual({ clearAction: true, applyAbortPenalty: true });
  });
});
