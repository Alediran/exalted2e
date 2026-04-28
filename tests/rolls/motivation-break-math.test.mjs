import { describe, it, expect } from "vitest";
import {
  findCampaign,
  validateNewCampaign,
  applyRefusalMath,
  applyRefundMath
} from "../../module/rolls/motivation-break-math.mjs";

describe("findCampaign", () => {
  it("returns null when defender has no motivationBreaks flag", () => {
    const defender = { flags: {} };
    expect(findCampaign(defender, "atk-1")).toBeNull();
  });

  it("returns null when flag exists but has no entry for this attacker", () => {
    const defender = { flags: { exalted2e: { motivationBreaks: { "other-attacker": {} } } } };
    expect(findCampaign(defender, "atk-1")).toBeNull();
  });

  it("returns the campaign object when one exists", () => {
    const campaign = { targetMotivation: "Be loyal", attemptCount: 2, status: "active" };
    const defender = { flags: { exalted2e: { motivationBreaks: { "atk-1": campaign } } } };
    expect(findCampaign(defender, "atk-1")).toBe(campaign);
  });
});

describe("validateNewCampaign", () => {
  function chr(id, motivation = "") {
    return { id, type: "character", system: { motivation } };
  }

  it("rejects NPC defender with reason 'npc-defender-unsupported'", () => {
    const attacker = chr("a1");
    const defender = { id: "d1", type: "npc", system: {} };
    const out = validateNewCampaign({ attacker, defender, targetMotivation: "X" });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("npc-defender-unsupported");
  });

  it("rejects self-attack with reason 'self-attack'", () => {
    const a = chr("same");
    const out = validateNewCampaign({ attacker: a, defender: a, targetMotivation: "X" });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("self-attack");
  });

  it("rejects blank target with reason 'blank-target'", () => {
    const a = chr("a1");
    const d = chr("d1", "Existing");
    expect(validateNewCampaign({ attacker: a, defender: d, targetMotivation: "" }).reason)
      .toBe("blank-target");
    expect(validateNewCampaign({ attacker: a, defender: d, targetMotivation: "   " }).reason)
      .toBe("blank-target");
  });

  it("rejects target equal to current motivation with reason 'target-equals-current'", () => {
    const a = chr("a1");
    const d = chr("d1", "Be a good king");
    const out = validateNewCampaign({ attacker: a, defender: d, targetMotivation: "Be a good king" });
    expect(out.reason).toBe("target-equals-current");
  });

  it("rejects when an existing campaign with status='broken' and original motivation unchanged", () => {
    const a = chr("a1");
    const d = chr("d1", "Loyalty");
    d.flags = { exalted2e: { motivationBreaks: { a1: {
      targetMotivation: "Loyalty",
      originalMotivation: "Freedom",
      status: "broken"
    } } } };
    // Defender's motivation now equals the broken-target, so we cannot start anew
    const out = validateNewCampaign({ attacker: a, defender: d, targetMotivation: "Honor" });
    expect(out.reason).toBe("already-broken");
  });

  it("returns {ok: true} for a valid new campaign", () => {
    const a = chr("a1");
    const d = chr("d1", "Honor");
    const out = validateNewCampaign({ attacker: a, defender: d, targetMotivation: "Loyalty" });
    expect(out.ok).toBe(true);
  });

  it("allows a new campaign when an existing entry is 'broken' but the defender's motivation has since changed", () => {
    // ST reset the defender to a new motivation; the prior break is stale.
    // New campaigns from the same attacker should be allowed again.
    const a = chr("a1");
    const d = chr("d1", "Independence");          // current motivation differs from prior broken target
    d.flags = { exalted2e: { motivationBreaks: { a1: {
      targetMotivation:   "Loyalty",              // prior broken target
      originalMotivation: "Freedom",
      status: "broken"
    } } } };
    const out = validateNewCampaign({ attacker: a, defender: d, targetMotivation: "Service" });
    expect(out.ok).toBe(true);
  });

  it("allows a follow-up attempt when an existing campaign is 'active' (Task 4 reuses the campaign)", () => {
    const a = chr("a1");
    const d = chr("d1", "Honor");
    d.flags = { exalted2e: { motivationBreaks: { a1: {
      targetMotivation:   "Loyalty",
      originalMotivation: "Honor",
      status: "active",
      attemptCount: 2
    } } } };
    const out = validateNewCampaign({ attacker: a, defender: d, targetMotivation: "Loyalty" });
    expect(out.ok).toBe(true);
  });
});

describe("applyRefusalMath", () => {
  it("max=5,value=5 -> max=4,value=4", () => {
    expect(applyRefusalMath(5, 5)).toEqual({ max: 4, value: 4 });
  });

  it("max=3,value=1 -> max=2,value=1 (value already below new max)", () => {
    expect(applyRefusalMath(3, 1)).toEqual({ max: 2, value: 1 });
  });

  it("max=1,value=1 -> max=0,value=0", () => {
    expect(applyRefusalMath(1, 1)).toEqual({ max: 0, value: 0 });
  });

  it("max=0,value=0 -> max=0,value=0 (defensive zero-floor)", () => {
    expect(applyRefusalMath(0, 0)).toEqual({ max: 0, value: 0 });
  });
});

describe("applyRefundMath", () => {
  it("restores +1 max and adds back the lost value (cascading from refusal)", () => {
    // Simulate: starting (max=5, value=5), refusal -> (max=4, value=4)
    // Refund with valueDelta=-1 (the value loss recorded by the refusal):
    //   newMax = 4 + 1 = 5, newValue = min(5, 4 - (-1)) = min(5, 5) = 5
    expect(applyRefundMath(4, 4, -1)).toEqual({ max: 5, value: 5 });
  });

  it("restores +1 max with valueDelta=0 (value was already below new max at refusal time)", () => {
    // (max=3, value=1) -> refusal -> (max=2, value=1, valueDelta=0)
    // Refund: newMax = 2 + 1 = 3, newValue = min(3, 1 - 0) = 1
    expect(applyRefundMath(2, 1, 0)).toEqual({ max: 3, value: 1 });
  });
});
