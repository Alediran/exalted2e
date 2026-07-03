import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { _seedAnimaPowersCompendium } from "../../module/helpers/anima-power-seeds.mjs";
import { EX2E } from "../../module/config.mjs";

// ── global Foundry mock setup ─────────────────────────────────────────────────

beforeAll(() => {
  game.exalted2e = { EX2E };
  globalThis.Folder = { create: vi.fn().mockResolvedValue({ id: "folder-1" }) };
  globalThis.Item   = { create: vi.fn().mockResolvedValue(undefined) };
});

function makePack(overrides = {}) {
  return {
    locked:     overrides.locked    ?? false,
    collection: "exalted2e.animapowers",
    folders:    overrides.folders   ?? [],
    configure:  vi.fn().mockResolvedValue(undefined),
    getIndex:   vi.fn().mockResolvedValue(overrides.index    ?? []),
    getDocuments: vi.fn().mockResolvedValue(overrides.docs   ?? []),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Folder.create = vi.fn().mockResolvedValue({ id: "folder-1" });
  Item.create   = vi.fn().mockResolvedValue(undefined);
});

// ── guard: no pack ────────────────────────────────────────────────────────────

describe("_seedAnimaPowersCompendium – no pack", () => {
  it("returns undefined when pack is not found", async () => {
    game.packs = { get: vi.fn().mockReturnValue(null) };
    await expect(_seedAnimaPowersCompendium()).resolves.toBeUndefined();
  });

  it("does not attempt to create items when pack is not found", async () => {
    game.packs = { get: vi.fn().mockReturnValue(null) };
    await _seedAnimaPowersCompendium();
    expect(Item.create).not.toHaveBeenCalled();
  });
});

// ── lock / unlock lifecycle ───────────────────────────────────────────────────

describe("_seedAnimaPowersCompendium – locked pack", () => {
  it("unlocks the pack before seeding", async () => {
    const pack = makePack({ locked: true });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    expect(pack.configure).toHaveBeenCalledWith({ locked: false });
  });

  it("re-locks the pack after seeding (finally block)", async () => {
    const pack = makePack({ locked: true });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    expect(pack.configure).toHaveBeenCalledWith({ locked: true });
  });

  it("calls configure twice for a locked pack (unlock + relock)", async () => {
    const pack = makePack({ locked: true });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    expect(pack.configure).toHaveBeenCalledTimes(2);
  });

  it("never calls configure for an unlocked pack", async () => {
    const pack = makePack({ locked: false });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    expect(pack.configure).not.toHaveBeenCalled();
  });
});

// ── seeding logic ─────────────────────────────────────────────────────────────

describe("_seedAnimaPowersCompendium – seeding", () => {
  it("calls Item.create when getIndex returns empty (seeds are missing)", async () => {
    const pack = makePack({ index: [] });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    expect(Item.create).toHaveBeenCalled();
  });

  it("creates items with type 'animapower'", async () => {
    const pack = makePack({ index: [] });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    const allCallTypes = Item.create.mock.calls.map(([data]) => data.type);
    expect(allCallTypes.every(t => t === "animapower")).toBe(true);
  });

  it("created items have exalted2e.animaPower flag", async () => {
    const pack = makePack({ index: [] });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    const firstData = Item.create.mock.calls[0][0];
    expect(firstData.flags.exalted2e.animaPower).toBe(true);
  });

  it("does not call Item.create when all seeds already exist", async () => {
    // game.i18n.localize is identity (k => k) so seed.nameKey === localized name
    const { _seedAnimaPowersCompendium: fn } = await import("../../module/helpers/anima-power-seeds.mjs");
    // Build an index containing every seed's nameKey as the name
    const { ANIMA_POWER_SEEDS: seeds } = await import("../../module/helpers/anima-power-seeds.mjs").catch(() => null) ?? {};
    // Since ANIMA_POWER_SEEDS is private, verify by checking Item.create was not called
    // when all names are known. We do this by running once (populates), clearing, then
    // providing an index with those same names.
    const pack1 = makePack({ index: [] });
    game.packs = { get: vi.fn().mockReturnValue(pack1) };
    await _seedAnimaPowersCompendium();
    const createdNames = Item.create.mock.calls.map(([d]) => d.name);

    vi.clearAllMocks();
    Folder.create = vi.fn().mockResolvedValue({ id: "folder-1" });
    Item.create   = vi.fn().mockResolvedValue(undefined);

    const fullIndex = createdNames.map(name => ({ name }));
    const pack2 = makePack({ index: fullIndex });
    game.packs = { get: vi.fn().mockReturnValue(pack2) };
    await _seedAnimaPowersCompendium();
    expect(Item.create).not.toHaveBeenCalled();
  });

  it("creates folders for each unique exalt type", async () => {
    const pack = makePack({ index: [] });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    expect(Folder.create).toHaveBeenCalled();
  });

  it("reuses existing folder when pack already has one by name", async () => {
    // Provide all folders up-front so Folder.create is never called
    const { _seedAnimaPowersCompendium: fn2 } = await import("../../module/helpers/anima-power-seeds.mjs");
    const pack1 = makePack({ index: [] });
    game.packs = { get: vi.fn().mockReturnValue(pack1) };
    await fn2();
    const folderNames = Folder.create.mock.calls.map(([d]) => d.name);
    vi.clearAllMocks();
    Folder.create = vi.fn().mockResolvedValue({ id: "folder-2" });
    Item.create   = vi.fn().mockResolvedValue(undefined);
    const preFolders = folderNames.map((name, i) => ({ name, id: `pre-${i}` }));
    const pack2 = makePack({ index: [], folders: preFolders });
    game.packs = { get: vi.fn().mockReturnValue(pack2) };
    await fn2();
    expect(Folder.create).not.toHaveBeenCalled();
  });
});

// ── folder-move pass ──────────────────────────────────────────────────────────

describe("_seedAnimaPowersCompendium – folder-move pass", () => {
  it("calls doc.update when a document has no folder but belongs to a known exalt type", async () => {
    const mockDoc = {
      folder: null,
      system: { exaltType: "solar" },
      update: vi.fn().mockResolvedValue(undefined),
    };
    const pack = makePack({ docs: [mockDoc] });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    expect(mockDoc.update).toHaveBeenCalledWith({ folder: expect.any(String) });
  });

  it("does not call doc.update when the document already has a folder", async () => {
    const mockDoc = {
      folder: "existing-folder-id",
      system: { exaltType: "solar" },
      update: vi.fn().mockResolvedValue(undefined),
    };
    const pack = makePack({ docs: [mockDoc] });
    game.packs = { get: vi.fn().mockReturnValue(pack) };
    await _seedAnimaPowersCompendium();
    expect(mockDoc.update).not.toHaveBeenCalled();
  });
});
