import { describe, it, expect } from "vitest";
import { buildComboPreviewRows } from "../../module/helpers/combo-display.mjs";

const charm = (id, uid, name, cost = {}) => ({ id, name, img: `${id}.webp`, system: { charmUid: uid, cost } });

describe("buildComboPreviewRows", () => {
  it("sums resolved charm costs into a preview string and counts missing uids", () => {
    const charms = [
      charm("c1", "u1", "A", { motes: 5, willpower: 1 }),
      charm("c2", "u2", "B", { motes: 3, bashingHealth: 2, xp: 1 }),
    ];
    const byUid = new Map(charms.map(c => [c.system.charmUid, c]));
    const combos = [{ id: "k", name: "K", img: "k.webp", system: { charmUids: ["u1", "u2", "gone"] } }];
    const [row] = buildComboPreviewRows(combos, byUid);
    expect(row).toMatchObject({
      id: "k", name: "K", totalCount: 3, missingCount: 1,
      costPreview: "8m 1wp 2b 1xp", canActivate: true,
    });
    expect(row.iconStrip.map(i => i.id)).toEqual(["c1", "c2"]);
  });
  it("all-missing combo → empty preview, canActivate false", () => {
    const [row] = buildComboPreviewRows([{ id: "k", name: "K", system: { charmUids: ["x"] } }], new Map());
    expect(row).toMatchObject({ missingCount: 1, costPreview: "", canActivate: false });
  });
  it("iconStrip caps at 6 resolved charms", () => {
    const charms = Array.from({ length: 8 }, (_, i) => charm(`c${i}`, `u${i}`, `C${i}`));
    const byUid = new Map(charms.map(c => [c.system.charmUid, c]));
    const [row] = buildComboPreviewRows([{ id: "k", name: "K", system: { charmUids: charms.map(c => c.system.charmUid) } }], byUid);
    expect(row.totalCount).toBe(8);
    expect(row.iconStrip).toHaveLength(6);
  });
});
