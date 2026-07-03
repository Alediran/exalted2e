import { vi, describe, it, expect, beforeEach } from "vitest";
import { TierSelectionDialog } from "../../module/apps/tier-selection-dialog.mjs";

describe("TierSelectionDialog.prompt", () => {
  const active = [
    { name: "Tier 1", level: 1 },
    { name: "Tier 2", level: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    foundry.applications.handlebars.renderTemplate.mockResolvedValue("<div>rendered</div>");
    foundry.applications.api.DialogV2.prompt = vi.fn().mockResolvedValue({ standard: true });
  });

  it("calls renderTemplate with the tier-selection-dialog template path", async () => {
    await TierSelectionDialog.prompt({ active });
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      "systems/exalted2e/templates/apps/tier-selection-dialog.hbs",
      expect.any(Object)
    );
  });

  it("passes the active array to renderTemplate as { active }", async () => {
    await TierSelectionDialog.prompt({ active });
    const [, context] = foundry.applications.handlebars.renderTemplate.mock.calls[0];
    expect(context).toEqual({ active });
  });

  it("calls DialogV2.prompt exactly once", async () => {
    await TierSelectionDialog.prompt({ active });
    expect(foundry.applications.api.DialogV2.prompt).toHaveBeenCalledTimes(1);
  });

  it("passes the rendered HTML as content to DialogV2.prompt", async () => {
    await TierSelectionDialog.prompt({ active });
    const [opts] = foundry.applications.api.DialogV2.prompt.mock.calls[0];
    expect(opts.content).toBe("<div>rendered</div>");
  });

  it("returns the value resolved by DialogV2.prompt", async () => {
    const expected = { standard: false, tier: active[0] };
    foundry.applications.api.DialogV2.prompt.mockResolvedValue(expected);
    const result = await TierSelectionDialog.prompt({ active });
    expect(result).toEqual(expected);
  });

  it("returns null when DialogV2.prompt resolves null (user cancelled)", async () => {
    foundry.applications.api.DialogV2.prompt.mockResolvedValue(null);
    const result = await TierSelectionDialog.prompt({ active });
    expect(result).toBeNull();
  });

  // ── ok.callback ────────────────────────────────────────────────────────────

  it("ok callback parses 'standard' → { standard: true }", async () => {
    await TierSelectionDialog.prompt({ active });
    const [opts] = foundry.applications.api.DialogV2.prompt.mock.calls[0];
    const btn = { form: { elements: { tierSelection: { value: "standard" } } } };
    expect(opts.ok.callback({}, btn)).toEqual({ standard: true });
  });

  it("ok callback parses 'tier_0' → { standard: false, tier: active[0] }", async () => {
    await TierSelectionDialog.prompt({ active });
    const [opts] = foundry.applications.api.DialogV2.prompt.mock.calls[0];
    const btn = { form: { elements: { tierSelection: { value: "tier_0" } } } };
    expect(opts.ok.callback({}, btn)).toEqual({ standard: false, tier: active[0] });
  });

  it("ok callback parses 'tier_1' → { standard: false, tier: active[1] }", async () => {
    await TierSelectionDialog.prompt({ active });
    const [opts] = foundry.applications.api.DialogV2.prompt.mock.calls[0];
    const btn = { form: { elements: { tierSelection: { value: "tier_1" } } } };
    expect(opts.ok.callback({}, btn)).toEqual({ standard: false, tier: active[1] });
  });

  it("ok callback falls back to { standard: true } when form is absent", async () => {
    await TierSelectionDialog.prompt({ active });
    const [opts] = foundry.applications.api.DialogV2.prompt.mock.calls[0];
    const btn = { form: null };
    expect(opts.ok.callback({}, btn)).toEqual({ standard: true });
  });

  it("ok callback uses the i18n key for the ok label", async () => {
    await TierSelectionDialog.prompt({ active });
    const [opts] = foundry.applications.api.DialogV2.prompt.mock.calls[0];
    // game.i18n.localize returns the key itself in tests
    expect(opts.ok.label).toBeDefined();
  });
});
