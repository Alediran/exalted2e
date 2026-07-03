import { sweep }              from "../_helpers/cleanup.mjs";
import { assertTestWorld }    from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { createTempItem }     from "../_helpers/items.mjs";

// Local poll helper (each Quench batch defines its own; render can be slow headless).
async function waitFor(predicate, { timeoutMs = 8000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

/** Item subtypes registered by the system (excludes the abstract "base"). */
function itemSubtypes() {
  const types = game.documentTypes?.Item ?? [];
  return types.filter(t => t && t !== "base");
}

export function registerItemSheets(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Item sheets (render + round-trip)", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // One generated test per registered Item subtype: render its sheet and
    // round-trip the name field (exercises _prepareContext / _onRender /
    // submitOnChange for every sheet class, incl. the generic sheet across
    // its many subtypes).
    for (const type of itemSubtypes()) {
      it(`[ISHEET] ${type} sheet renders and round-trips its name`, async () => {
        const actor = await createTempCharacter({ name: `Q-IS-${type}` });
        // Spells are gated by the preCreateItem initiation check — a character
        // with 0 sorcery initiation cannot hold even a 1st-circle spell, so the
        // create would be cancelled. Grant initiation so the default
        // sorcery/circle-1 spell can be created.
        if (type === "spell") await actor.update({ "system.sorcery.initiation": 3 });
        const item  = await createTempItem(actor, { name: `Q ${type}`, type });

        await item.sheet.render(true);
        await waitFor(() => item.sheet.rendered && !!item.sheet.element);
        const el = item.sheet.element;
        assert.ok(el, `${type} sheet rendered an element`);

        // Universal field round-trip via the header name input, when present.
        const nameInput = el.querySelector("input[name='name']");
        if (nameInput) {
          const newName = `Renamed ${type}`;
          nameInput.value = newName;
          nameInput.dispatchEvent(new Event("change", { bubbles: true }));
          await waitFor(() => item.name === newName);
          assert.equal(item.name, newName, `${type} name round-trip via submitOnChange`);
        }

        await item.sheet.close();
      });
    }

    // ── Targeted: charm keyword add/remove mutates system.keywords ──────────
    it("[ISHEET] charm sheet add/remove keyword mutates system.keywords", async () => {
      const actor = await createTempCharacter({ name: "Q-IS-charm-act" });
      const item  = await createTempItem(actor, { name: "Q Charm Act", type: "charm" });

      await item.sheet.render(true);
      await waitFor(() => item.sheet.rendered && !!item.sheet.element);

      const before  = (item.system.keywords ?? []).length;
      const addBtn  = await waitFor(() => item.sheet.element.querySelector("[data-action='addKeyword']"));
      addBtn.click();
      await waitFor(() => (item.system.keywords ?? []).length === before + 1);

      const removeBtn = await waitFor(() => item.sheet.element.querySelector("[data-action='removeKeyword']"));
      removeBtn.click();
      await waitFor(() => (item.system.keywords ?? []).length === before);
      assert.equal((item.system.keywords ?? []).length, before, "keyword added then removed");

      await item.sheet.close();
    });

    // ── Targeted: combo removeCharm mutates system.charmUids ────────────────
    it("[ISHEET] combo sheet removeCharm mutates system.charmUids", async () => {
      const actor = await createTempCharacter({ name: "Q-IS-combo-act" });
      await createTempItem(actor, { name: "Q Combo Charm", type: "charm", "system.charmUid": "uid-real" });
      const combo = await createTempItem(actor, {
        name: "Q Combo Act", type: "combo", "system.charmUids": ["uid-real"],
      });

      await combo.sheet.render(true);
      await waitFor(() => combo.sheet.rendered && !!combo.sheet.element);

      const removeBtn = await waitFor(() =>
        combo.sheet.element.querySelector("[data-action='removeCharm'][data-index='0']")
      );
      removeBtn.click();
      await waitFor(() => (combo.system.charmUids ?? []).length === 0);
      assert.deepEqual(combo.system.charmUids, [], "charmUid removed from the combo");

      await combo.sheet.close();
    });

    // ── Targeted: description-language UI renders + override persists ────────
    it("[ISHEET] description tab exposes a language dropdown + per-language editors that persist", async () => {
      const actor = await createTempCharacter({ name: "Q-IS-desclang-act" });
      const item  = await createTempItem(actor, { name: "Q-DescLang", type: "charm" });

      await item.sheet.render(true);
      await waitFor(() => item.sheet.rendered && !!item.sheet.element);
      try {
        const el = item.sheet.element;
        const select = el.querySelector(".ex2e-desc-lang-select");
        assert.ok(select, "language dropdown present");
        const defaultEd = el.querySelector('.ex2e-desc-editor[data-lang="__default"]');
        assert.ok(defaultEd, "default editor present");
        // ProseMirror UI is hard to drive headlessly — persist an override directly.
        await item.update({ "system.descriptions.es": "<p>hola</p>" });
        assert.equal(item.system.descriptions.es, "<p>hola</p>", "es override persists");
      } finally { await item.sheet.close(); }
    });

    // ── Targeted: generic (manse) addMansePower mutates system.powers ───────
    it("[ISHEET] manse sheet addMansePower mutates system.powers", async () => {
      const actor = await createTempCharacter({ name: "Q-IS-manse-act" });
      const item  = await createTempItem(actor, { name: "Q Manse Act", type: "manse" });

      await item.sheet.render(true);
      await waitFor(() => item.sheet.rendered && !!item.sheet.element);

      const before = (item.system.powers ?? []).length;
      const addBtn = await waitFor(() => item.sheet.element.querySelector("[data-action='addMansePower']"));
      addBtn.click();
      await waitFor(() => (item.system.powers ?? []).length === before + 1);
      assert.equal((item.system.powers ?? []).length, before + 1, "blank manse power added");

      await item.sheet.close();
    });
  });
}
