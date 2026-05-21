import { describe, it, expect } from "vitest";

// Inline the lookup tables (mirrors config.mjs values)
const CULT_MOTE_REGEN = [0, 0, 2, 3, 4, 6];
const CULT_WP_HOURS   = [0, 24, 24, 24, 12, 6];

function prepareCultData(items) {
  let totalMotes  = 0;
  let minInterval = 0;
  for (const item of items) {
    if (item.type !== "cult") continue;
    const bg = items.find(i => i.id === item.system.backgroundId && i.type === "background");
    if (!bg) continue;
    const rating = Math.max(0, Math.min(5, bg.system.value ?? 0));
    totalMotes += CULT_MOTE_REGEN[rating];
    const interval = CULT_WP_HOURS[rating];
    if (interval > 0) minInterval = minInterval === 0 ? interval : Math.min(minInterval, interval);
  }
  return { cultMoteRegen: totalMotes, cultWpHours: minInterval };
}

describe("_prepareCultData", () => {
  it("returns zeros when no cult items exist", () => {
    expect(prepareCultData([])).toEqual({ cultMoteRegen: 0, cultWpHours: 0 });
  });

  it("returns zeros when cult has no linked background", () => {
    const items = [{ id: "c1", type: "cult", system: { backgroundId: "" } }];
    expect(prepareCultData(items)).toEqual({ cultMoteRegen: 0, cultWpHours: 0 });
  });

  it("returns 0 motes and 24h WP interval for dot 1", () => {
    const items = [
      { id: "bg1", type: "background", system: { value: 1 } },
      { id: "c1",  type: "cult",       system: { backgroundId: "bg1" } }
    ];
    expect(prepareCultData(items)).toEqual({ cultMoteRegen: 0, cultWpHours: 24 });
  });

  it("returns 2 motes/hr and 24h WP interval for dot 2", () => {
    const items = [
      { id: "bg1", type: "background", system: { value: 2 } },
      { id: "c1",  type: "cult",       system: { backgroundId: "bg1" } }
    ];
    expect(prepareCultData(items)).toEqual({ cultMoteRegen: 2, cultWpHours: 24 });
  });

  it("returns 6 motes/hr and 6h WP interval for dot 5", () => {
    const items = [
      { id: "bg1", type: "background", system: { value: 5 } },
      { id: "c1",  type: "cult",       system: { backgroundId: "bg1" } }
    ];
    expect(prepareCultData(items)).toEqual({ cultMoteRegen: 6, cultWpHours: 6 });
  });

  it("sums motes and takes minimum interval across multiple cults", () => {
    // Cult dot-3 (3/hr, 24h) + Cult dot-4 (4/hr, 12h) → 7/hr, 12h
    const items = [
      { id: "bg1", type: "background", system: { value: 3 } },
      { id: "bg2", type: "background", system: { value: 4 } },
      { id: "c1",  type: "cult",       system: { backgroundId: "bg1" } },
      { id: "c2",  type: "cult",       system: { backgroundId: "bg2" } }
    ];
    expect(prepareCultData(items)).toEqual({ cultMoteRegen: 7, cultWpHours: 12 });
  });

  it("clamps background value to 0–5", () => {
    const items = [
      { id: "bg1", type: "background", system: { value: 99 } },
      { id: "c1",  type: "cult",       system: { backgroundId: "bg1" } }
    ];
    expect(prepareCultData(items)).toEqual({ cultMoteRegen: 6, cultWpHours: 6 });
  });
});
