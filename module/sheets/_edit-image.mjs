/**
 * Shared `editImage` action handler for ApplicationV2 sheets.
 *
 * ApplicationV2 / DocumentSheetV2 doesn't auto-provide an `editImage` action
 * the way the v1 sheets did, so every sheet that wants `<img data-action="editImage">`
 * to actually persist a change has to register its own handler. This module
 * exports a single function that can be plugged into any sheet's
 * `DEFAULT_OPTIONS.actions` block:
 *
 *   import { editImageAction } from "../_edit-image.mjs";
 *
 *   static DEFAULT_OPTIONS = {
 *     ...
 *     actions: {
 *       ...
 *       editImage: editImageAction
 *     }
 *   };
 *
 * The function is a regular (non-arrow) function so ApplicationV2's action
 * dispatcher binds `this` to the sheet instance. The handler reads the
 * clicked element's optional `data-edit` attribute (defaulting to `"img"`),
 * opens a FilePicker rooted at the document's current value for that path,
 * and persists the chosen path via `document.update({ [attr]: path })`.
 *
 * Tokenizer-compatibility note: Tokenizer typically intercepts portrait
 * clicks via a capture-phase listener registered in render hooks, BEFORE
 * the framework's action delegation. When Tokenizer is active and
 * intercepts, this handler simply doesn't run — clean handoff. We don't
 * stopPropagation or override globals, so Tokenizer's hook order wins.
 */
export async function editImageAction(event, target) {
  if (!this.isEditable) return;
  // Module override hook: if a third-party module (e.g., Tokenizer in a
  // future v2-aware version) patches `_onEditImage` onto the sheet's
  // prototype, delegate to it. This is the v1 convention several
  // image-editor modules hook, exposed here as a forward-compat point.
  if (typeof this._onEditImage === "function") {
    return this._onEditImage(event, target);
  }
  const attr = target.dataset.edit ?? "img";
  const current = foundry.utils.getProperty(this.document, attr) ?? "";
  const fp = new foundry.applications.apps.FilePicker.implementation({
    type:     "image",
    current,
    callback: (path) => this.document.update({ [attr]: path })
  });
  return fp.render(true);
}
