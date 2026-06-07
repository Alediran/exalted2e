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
 */
export async function editImageAction(event, target) {
  if (!this.isEditable) return;
  const attr = target.dataset.edit ?? "img";
  const current = foundry.utils.getProperty(this.document, attr) ?? "";
  const fp = new foundry.applications.apps.FilePicker.implementation({
    type:     "image",
    current,
    callback: (path) => this.document.update({ [attr]: path })
  });
  return fp.render(true);
}
