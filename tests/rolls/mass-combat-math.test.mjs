import { describe, it, expect } from "vitest";
import {
  computeAttackPool,
  computeNetDamage,
  computeRoutDifficulty,
  computeIsRouted,
  computeMagnitudeAfterDamage,
  computeMagnitudeAfterRout,
  computeJoinWarPool,
  computeEffectiveCCR,
  computeEffectiveRCR,
  computeMagnitudeDiffBonus,
  computeHealthTrackMagLoss,
  computeRoutPool,
  computeFormationRoutMod,
  computeRoutMagLoss,
  computeUnitParryDV,
  computeHeroNetDamage
} from "../../module/rolls/mass-combat-math.mjs";

describe("computeAttackPool", () => {
  it("adds commanderWarDice and drill", () => {
    expect(computeAttackPool(2, 3)).toBe(5);
  });
  it("treats null commanderWarDice as 0", () => {
    expect(computeAttackPool(null, 2)).toBe(2);
  });
  it("treats undefined commanderWarDice as 0", () => {
    expect(computeAttackPool(undefined, 4)).toBe(4);
  });
});

describe("computeNetDamage", () => {
  it("returns positive difference when might exceeds endurance", () => {
    expect(computeNetDamage(4, 2)).toBe(2);
  });
  it("returns 0 when endurance equals might", () => {
    expect(computeNetDamage(3, 3)).toBe(0);
  });
  it("returns 0 when endurance exceeds might", () => {
    expect(computeNetDamage(1, 4)).toBe(0);
  });
});

describe("computeRoutDifficulty", () => {
  it("equals netDamage", () => {
    expect(computeRoutDifficulty(3)).toBe(3);
  });
  it("equals 0 when no damage dealt", () => {
    expect(computeRoutDifficulty(0)).toBe(0);
  });
});

describe("computeIsRouted", () => {
  it("true when magnitude is 0", () => {
    expect(computeIsRouted(0)).toBe(true);
  });
  it("false when magnitude is positive", () => {
    expect(computeIsRouted(1)).toBe(false);
    expect(computeIsRouted(5)).toBe(false);
  });
});

describe("computeMagnitudeAfterDamage", () => {
  it("subtracts netDamage from current magnitude", () => {
    expect(computeMagnitudeAfterDamage(5, 2)).toBe(3);
  });
  it("floors at 0 when damage exceeds magnitude", () => {
    expect(computeMagnitudeAfterDamage(1, 3)).toBe(0);
  });
  it("unchanged when netDamage is 0", () => {
    expect(computeMagnitudeAfterDamage(4, 0)).toBe(4);
  });
});

describe("computeMagnitudeAfterRout", () => {
  it("unchanged when unit holds", () => {
    expect(computeMagnitudeAfterRout(3, true)).toBe(3);
  });
  it("decrements by 1 when unit routs", () => {
    expect(computeMagnitudeAfterRout(3, false)).toBe(2);
  });
  it("floors at 0 when rout from magnitude 0", () => {
    expect(computeMagnitudeAfterRout(0, false)).toBe(0);
  });
});

describe("computeJoinWarPool", () => {
  const commander = {
    system: {
      attributes: { wits: { value: 3 } },
      abilities:  { war: { value: 4 }, awareness: { value: 2 } }
    }
  };

  it("formation=none uses wits+awareness", () => {
    expect(computeJoinWarPool(commander, "none", 3)).toBe(5);
  });
  it("formation=unordered uses wits+war minus magnitude", () => {
    expect(computeJoinWarPool(commander, "unordered", 3)).toBe(4);
  });
  it("floors at 0 when magnitude exceeds wits+war", () => {
    expect(computeJoinWarPool(commander, "close", 10)).toBe(0);
  });
  it("returns 0 when commander is null", () => {
    expect(computeJoinWarPool(null, "unordered", 3)).toBe(0);
  });
});

describe("computeEffectiveCCR", () => {
  it("non-close: min of ccr and warRating", () => {
    expect(computeEffectiveCCR(3, 2, "unordered")).toBe(2);
    expect(computeEffectiveCCR(1, 4, "skirmish")).toBe(1);
  });
  it("close formation: min of ccr*2 and warRating*2", () => {
    expect(computeEffectiveCCR(2, 3, "close")).toBe(4);
    expect(computeEffectiveCCR(4, 2, "close")).toBe(4);
  });
  it("close with ccr=0 returns 0", () => {
    expect(computeEffectiveCCR(0, 3, "close")).toBe(0);
  });
});

describe("computeEffectiveRCR", () => {
  it("min of rcr and warRating", () => {
    expect(computeEffectiveRCR(3, 2)).toBe(2);
    expect(computeEffectiveRCR(1, 4)).toBe(1);
  });
  it("returns 0 when either is 0", () => {
    expect(computeEffectiveRCR(0, 3)).toBe(0);
    expect(computeEffectiveRCR(3, 0)).toBe(0);
  });
});

describe("computeMagnitudeDiffBonus", () => {
  it("positive difference is attacker advantage", () => {
    expect(computeMagnitudeDiffBonus(5, 3)).toBe(2);
  });
  it("negative difference is attacker disadvantage", () => {
    expect(computeMagnitudeDiffBonus(2, 5)).toBe(-3);
  });
  it("clamps at +3", () => {
    expect(computeMagnitudeDiffBonus(10, 3)).toBe(3);
  });
  it("clamps at -3", () => {
    expect(computeMagnitudeDiffBonus(1, 8)).toBe(-3);
  });
  it("equal magnitude gives 0", () => {
    expect(computeMagnitudeDiffBonus(4, 4)).toBe(0);
  });
});

describe("computeHealthTrackMagLoss", () => {
  it("no cycle when damage does not exhaust health", () => {
    const r = computeHealthTrackMagLoss(7, 7, 3, 5);
    expect(r.newHealth).toBe(4);
    expect(r.magLost).toBe(0);
  });
  it("one cycle when health hits exactly 0", () => {
    const r = computeHealthTrackMagLoss(7, 7, 7, 5);
    expect(r.newHealth).toBe(7);
    expect(r.magLost).toBe(1);
  });
  it("multi-cycle: health=3 max=7 damage=15 magnitude=5", () => {
    const r = computeHealthTrackMagLoss(3, 7, 15, 5);
    expect(r.magLost).toBe(2);
    expect(r.newHealth).toBe(2);
  });
  it("stops cycling when magnitude would hit 0", () => {
    const r = computeHealthTrackMagLoss(1, 7, 10, 1);
    expect(r.magLost).toBe(1);
    expect(r.newHealth).toBe(0);
  });
});

describe("computeRoutPool", () => {
  it("morale + (magnitude - drill)", () => {
    expect(computeRoutPool(3, 4, 2)).toBe(5);
  });
  it("floors at 1 when sum is negative", () => {
    expect(computeRoutPool(1, 1, 5)).toBe(1);
  });
  it("floors at 1 when sum is zero", () => {
    expect(computeRoutPool(2, 2, 4)).toBe(1);
  });
});

describe("computeFormationRoutMod", () => {
  it("close formation is -2", () => {
    expect(computeFormationRoutMod("close")).toBe(-2);
  });
  it("skirmish is +2", () => {
    expect(computeFormationRoutMod("skirmish")).toBe(2);
  });
  it("unordered is +2", () => {
    expect(computeFormationRoutMod("unordered")).toBe(2);
  });
  it("relaxed is 0", () => {
    expect(computeFormationRoutMod("relaxed")).toBe(0);
  });
  it("none (solo) is 0", () => {
    expect(computeFormationRoutMod("none")).toBe(0);
  });
});

describe("computeRoutMagLoss", () => {
  it("diff=3 successes=1 → magLoss=2", () => {
    expect(computeRoutMagLoss(3, 1)).toBe(2);
  });
  it("successes equal diff → 0 loss", () => {
    expect(computeRoutMagLoss(2, 2)).toBe(0);
  });
  it("successes exceed diff → 0 loss", () => {
    expect(computeRoutMagLoss(1, 4)).toBe(0);
  });
});

describe("computeUnitParryDV", () => {
  it("commander parryDV 4 + ccr 3 → floor(5.5) = 5", () => {
    expect(computeUnitParryDV(4, 3)).toBe(5);
  });
  it("commander parryDV 3 + ccr 0 → 3", () => {
    expect(computeUnitParryDV(3, 0)).toBe(3);
  });
  it("odd ccr floors correctly: parryDV 2 + ccr 1 → floor(2.5) = 2", () => {
    expect(computeUnitParryDV(2, 1)).toBe(2);
  });
});

describe("computeHeroNetDamage", () => {
  it("magnitude floor when soak exceeds successes: 2 successes, 5 soak, magnitude 3 → 3", () => {
    expect(computeHeroNetDamage(2, 5, 3)).toBe(3);
  });
  it("normal soak when successes win: 8 successes, 2 soak, magnitude 3 → 6", () => {
    expect(computeHeroNetDamage(8, 2, 3)).toBe(6);
  });
  it("exactly equal successes and soak → magnitude floor", () => {
    expect(computeHeroNetDamage(3, 3, 2)).toBe(2);
  });
  it("zero magnitude → floor at 0, not negative", () => {
    expect(computeHeroNetDamage(1, 5, 0)).toBe(0);
  });
});
