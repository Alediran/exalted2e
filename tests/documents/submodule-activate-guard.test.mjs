import { beforeEach, describe, it, expect, vi } from "vitest";
import { ExaltedItem } from "../../module/documents/item.mjs";

/**
 * Build a minimal synthetic item suitable for calling `activateCharm`
 * directly against the guard logic. The actor stub is minimal — just
 * enough so the method doesn't bail at the `!actor` check before the
 * guard we're testing.
 */
function makeSubmoduleItem({
  duration         = "permanent",
  active           = false,
  effectivelyActive = false,
} = {}) {
  const actor = {
    type:   "character",
    system: {
      willpower:  { value: 5, max: 5 },
      experience: { value: 10, total: 10 }
    },
    spendMotes:  vi.fn().mockResolvedValue(null),
    applyDamage: vi.fn().mockResolvedValue(true),
    update:      vi.fn().mockResolvedValue(true),
    effects:     { filter: vi.fn().mockReturnValue([]) },
    items:       { filter: vi.fn().mockReturnValue([]) }
  };

  return {
    type:   "charm",
    name:   "Test Submodule",
    actor,
    system: {
      isSubmodule:      true,
      effectivelyActive,
      duration,
      active,
      cost:             {},
      charmType:        "permanent",
      attack:           { enabled: false },
      prerequisites:    [],
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  foundry.applications.api.DialogV2.confirm.mockResolvedValue(true);
});

describe("activateCharm — submodule guard", () => {
  it("Test A: submodule with effectivelyActive=false and active=false → returns false, warns", async () => {
    const item = makeSubmoduleItem({ effectivelyActive: false, active: false });

    const result = await ExaltedItem.prototype.activateCharm.call(item);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith("EX2E.SubmoduleNotActive");
  });

  it("Test B: submodule with effectivelyActive=false but duration=oneScene and active=true (turn-off) → does NOT warn", async () => {
    const item = makeSubmoduleItem({
      effectivelyActive: false,
      duration: "oneScene",
      active:   true,
    });

    // The method will proceed past the guard and eventually fail at the
    // ledger / prereq-check step. We only care that warn was NOT called
    // for the SubmoduleNotActive key.
    await ExaltedItem.prototype.activateCharm.call(item).catch(() => {});

    const warnCalls = ui.notifications.warn.mock.calls;
    const guardWarned = warnCalls.some(([msg]) => msg === "EX2E.SubmoduleNotActive");
    expect(guardWarned).toBe(false);
  });
});
