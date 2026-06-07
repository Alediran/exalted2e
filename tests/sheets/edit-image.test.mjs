import { describe, it, expect, vi, beforeEach } from "vitest";
import { editImageAction } from "../../module/sheets/_edit-image.mjs";

// Provide the Foundry globals editImageAction touches.
beforeEach(() => {
  globalThis.foundry ??= {};
  globalThis.foundry.utils ??= {};
  globalThis.foundry.utils.getProperty = (obj, path) =>
    path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  globalThis.foundry.applications = undefined;
});

function withFilePicker() {
  const calls = { opts: undefined, renderArgs: undefined };
  globalThis.foundry.applications = {
    apps: { FilePicker: { implementation: class {
      constructor(o) { calls.opts = o; }
      render(...args) { calls.renderArgs = args; return this; }
    } } },
  };
  return calls;
}

describe("editImageAction", () => {
  it("returns early and opens nothing when not editable", async () => {
    const fp = withFilePicker();
    const update = vi.fn();
    await editImageAction.call({ isEditable: false, document: { update } }, {}, { dataset: {} });
    expect(update).not.toHaveBeenCalled();
    expect(fp.opts).toBeUndefined();
  });

  it("opens a FilePicker rooted at the current img and persists the chosen path", async () => {
    const fp = withFilePicker();
    const update = vi.fn();
    await editImageAction.call({ isEditable: true, document: { img: "old.webp", update } }, {}, { dataset: {} });
    expect(fp.opts.type).toBe("image");
    expect(fp.opts.current).toBe("old.webp");
    fp.opts.callback("new.webp");
    expect(update).toHaveBeenCalledWith({ img: "new.webp" });
    expect(fp.renderArgs).toEqual([true]);
  });

  it("honors data-edit for a non-default attribute path", async () => {
    const fp = withFilePicker();
    const update = vi.fn();
    const sheet = { isEditable: true, document: { update, system: { icon: "a.webp" } } };
    await editImageAction.call(sheet, {}, { dataset: { edit: "system.icon" } });
    expect(fp.opts.current).toBe("a.webp");
    fp.opts.callback("b.webp");
    expect(update).toHaveBeenCalledWith({ "system.icon": "b.webp" });
    expect(fp.renderArgs).toEqual([true]);
  });
});
