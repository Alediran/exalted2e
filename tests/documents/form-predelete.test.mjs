import { describe, it, expect, vi } from "vitest";
import { ExaltedItem } from "../../module/documents/item.mjs";

function makeFakeFormItem({
  id = "form-tigress",
  activeFormId = "",
  spiritShapeFormId = ""
} = {}) {
  const actor = {
    type: "character",
    system: { splat: { lunar: { activeFormId, spiritShapeFormId } } },
    update: vi.fn().mockResolvedValue(true)
  };
  return {
    actor,
    id,
    type: "form",
    system: { artifact: false, attuned: false, attunementCost: 0 },
    getFlag: () => null,
    flags:   {}
  };
}

describe("ExaltedItem._preDelete (form item cleanup)", () => {
  it("clears activeFormId when the deleted form is currently active", async () => {
    const item = makeFakeFormItem({ id: "form-tigress", activeFormId: "form-tigress" });
    await ExaltedItem.prototype._preDelete.call(item, {}, "user-id");
    expect(item.actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.splat.lunar.activeFormId": "" })
    );
  });

  it("clears both activeFormId and spiritShapeFormId when the deleted form is both", async () => {
    const item = makeFakeFormItem({
      id: "form-tigress",
      activeFormId: "form-tigress",
      spiritShapeFormId: "form-tigress"
    });
    await ExaltedItem.prototype._preDelete.call(item, {}, "user-id");
    expect(item.actor.update).toHaveBeenCalledWith({
      "system.splat.lunar.activeFormId":      "",
      "system.splat.lunar.spiritShapeFormId": ""
    });
  });

  it("does not call update when the deleted form is neither active nor spirit shape", async () => {
    const item = makeFakeFormItem({
      id: "form-other",
      activeFormId: "form-tigress",
      spiritShapeFormId: "form-tigress"
    });
    await ExaltedItem.prototype._preDelete.call(item, {}, "user-id");
    expect(item.actor.update).not.toHaveBeenCalled();
  });
});
