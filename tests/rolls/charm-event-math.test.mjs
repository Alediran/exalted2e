import { describe, it, expect } from "vitest";
import {
  collectMoteRecoveryCharms,
  collectStatusApplyCharms,
  computeTargetPenaltyAmount,
  collectWillpowerRecoveryCharms,
} from "../../module/rolls/charm-event-math.mjs";

describe("collectMoteRecoveryCharms", () => {
  it("returns empty array when no charms", () => {
    expect(collectMoteRecoveryCharms([], "onDamageReceived")).toEqual([]);
  });

  it("returns charms matching the event", () => {
    const charms = [
      { system: { moteRecovery: { enabled: true, event: "onDamageReceived", action: "recoverPeripheral", formula: "1" }}},
      { system: { moteRecovery: { enabled: true, event: "onKill",            action: "recoverPeripheral", formula: "1" }}}
    ];
    expect(collectMoteRecoveryCharms(charms, "onDamageReceived")).toHaveLength(1);
    expect(collectMoteRecoveryCharms(charms, "onKill")).toHaveLength(1);
  });

  it("skips disabled charms", () => {
    const charms = [{ system: { moteRecovery: { enabled: false, event: "onDamageReceived", action: "recoverPeripheral", formula: "1" }}}];
    expect(collectMoteRecoveryCharms(charms, "onDamageReceived")).toHaveLength(0);
  });

  it("returns charms for onAttackSuccess event", () => {
    const charms = [{ system: { moteRecovery: { enabled: true, event: "onAttackSuccess", action: "recoverPersonal", formula: "@ess" }}}];
    expect(collectMoteRecoveryCharms(charms, "onAttackSuccess")).toHaveLength(1);
  });
});

describe("collectStatusApplyCharms", () => {
  it("returns empty when no charms", () => {
    expect(collectStatusApplyCharms([])).toEqual([]);
  });

  it("returns only enabled statusApply charms", () => {
    const charms = [
      { system: { statusApply: { enabled: true,  status: "Poison",    resistPool: "@sta + @resistance", onFail: "applyPoison" }}},
      { system: { statusApply: { enabled: false, status: "Crippling", resistPool: "",                   onFail: "applyCrippling" }}}
    ];
    expect(collectStatusApplyCharms(charms)).toHaveLength(1);
    expect(collectStatusApplyCharms(charms)[0].system.statusApply.status).toBe("Poison");
  });
});

describe("computeTargetPenaltyAmount", () => {
  it("returns 0 when no charms", () => {
    expect(computeTargetPenaltyAmount([])).toBe(0);
  });

  it("sums negative penalty amounts from all charms", () => {
    const charms = [
      { system: { targetPenalty: { enabled: true, amount: -1, scope: "all", duration: "scene" }}},
      { system: { targetPenalty: { enabled: true, amount: -2, scope: "all", duration: "scene" }}}
    ];
    expect(computeTargetPenaltyAmount(charms)).toBe(-3);
  });

  it("skips disabled charms", () => {
    const charms = [{ system: { targetPenalty: { enabled: false, amount: -5, scope: "all", duration: "scene" }}}];
    expect(computeTargetPenaltyAmount(charms)).toBe(0);
  });
});

describe("computeTargetPenaltyAmount — targeted test", () => {
  it("searing-fist-attack gives -1 to all actions", () => {
    const charms = [{ system: { targetPenalty: {
      enabled: true, amount: -1, scope: "all", duration: "scene"
    }}}];
    expect(computeTargetPenaltyAmount(charms)).toBe(-1);
  });
});

describe("computeTargetPenaltyAmount — amountFormula", () => {
  it("uses amountFormula when set, overriding static amount", () => {
    const charms = [{ system: { targetPenalty: {
      enabled: true, amount: -1, amountFormula: "-3", scope: "all", duration: "scene"
    }}}];
    expect(computeTargetPenaltyAmount(charms, {})).toBe(-3);
  });

  it("falls back to static amount when amountFormula is empty", () => {
    const charms = [{ system: { targetPenalty: {
      enabled: true, amount: -2, amountFormula: "", scope: "all", duration: "scene"
    }}}];
    expect(computeTargetPenaltyAmount(charms, {})).toBe(-2);
  });
});

describe("collectWillpowerRecoveryCharms", () => {
  it("returns empty when no charms", () => {
    expect(collectWillpowerRecoveryCharms([], "onDamageDealt")).toEqual([]);
  });
  it("returns charms matching the event", () => {
    const charms = [
      { system: { willpowerRecovery: { enabled: true, event: "onDamageDealt",   formula: "1" }}},
      { system: { willpowerRecovery: { enabled: true, event: "onAttackSuccess", formula: "1" }}}
    ];
    expect(collectWillpowerRecoveryCharms(charms, "onDamageDealt")).toHaveLength(1);
  });
  it("skips disabled charms", () => {
    const charms = [{ system: { willpowerRecovery: { enabled: false, event: "onDamageDealt", formula: "1" }}}];
    expect(collectWillpowerRecoveryCharms(charms, "onDamageDealt")).toHaveLength(0);
  });
});
