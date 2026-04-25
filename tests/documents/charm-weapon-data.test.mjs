import { describe, it, expect } from "vitest";
import { buildCharmWeaponData } from "../../module/documents/charm-weapon-data.mjs";

describe("buildCharmWeaponData", () => {
  it("all-numeric attack stats produce a weapon createDocument payload", () => {
    const out = buildCharmWeaponData({
      attack: {
        name: "Fire and Stones Strike",
        speed: 5, accuracy: 2, damage: 6, damageType: "lethal",
        overwhelming: 3, defense: 0, rate: 1, range: 0,
        minStrength: 0, minDexterity: 0, minMartialArts: 0,
        tags: ["Overwhelming"]
      },
      name:     "Fire and Stones Strike",
      img:      "icons/sword.svg",
      id:       "charm-id-1",
      duration: "instant",
      rollData: {}
    });
    expect(out.type).toBe("weapon");
    expect(out.name).toBe("Fire and Stones Strike");
    expect(out.flags.exalted2e.charmSource).toBe("charm-id-1");
    expect(out.flags.exalted2e.charmDuration).toBe("instant");
    expect(out.system.modes).toHaveLength(1);
    const mode = out.system.modes[0];
    expect(mode.speed).toBe(5);
    expect(mode.accuracy).toBe(2);
    expect(mode.damage).toBe(6);
    expect(mode.damageType).toBe("lethal");
    expect(mode.overwhelming).toBe(3);
    expect(mode.tags).toEqual(["Overwhelming"]);
  });

  it("formula stats evaluate against rollData", () => {
    const out = buildCharmWeaponData({
      attack:   { speed: "@ess + 4", damage: "@str + @ess / 2" },
      name:     "Test Charm",
      img:      "",
      id:       "x",
      duration: "instant",
      rollData: { ess: 3, str: 4 }
    });
    expect(out.system.modes[0].speed).toBe(7);                     // 3 + 4
    expect(out.system.modes[0].damage).toBe(5);                    // floor(4 + 1.5)
  });

  it("empty / whitespace attack.name falls back to the charm name", () => {
    const out = buildCharmWeaponData({
      attack:   { name: "   " },
      name:     "Charm Name",
      img:      "icons/test.svg",
      id:       "x",
      duration: "instant",
      rollData: {}
    });
    expect(out.name).toBe("Charm Name");
    expect(out.system.modes[0].name).toBe("Charm Name");
  });

  it("missing attack uses the documented per-field fallbacks", () => {
    const out = buildCharmWeaponData({
      attack:   undefined,
      name:     "Charm",
      img:      undefined,
      id:       "x",
      duration: "instant",
      rollData: {}
    });
    const mode = out.system.modes[0];
    expect(mode.speed).toBe(5);
    expect(mode.accuracy).toBe(0);
    expect(mode.damage).toBe(1);
    expect(mode.damageType).toBe("lethal");
    expect(mode.overwhelming).toBe(1);
    expect(mode.tags).toEqual([]);
    expect(out.img).toBe("icons/svg/sword.svg");                   // default sword icon
  });
});
