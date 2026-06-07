import { register, sweep }       from "../_helpers/cleanup.mjs";
import { assertTestWorld }       from "../_helpers/world.mjs";
import { createTempCharacter }   from "../_helpers/actors.mjs";
import { GmRollPoolDialog }      from "../../../module/dialogs/gm-roll-pool-dialog.mjs";

async function waitFor(predicate, { timeoutMs = 8000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

// Authored token values from styles/_variables.css (normalized: lowercased, spaces removed).
const norm = v => String(v).toLowerCase().replace(/\s+/g, "");
const EXPECTED = {
  dark: {
    "--ex2e-gold-bright": "#ffe066", "--ex2e-text-primary": "#e8dcc8",
    "--ex2e-bg-panel": "#141414", "--ex2e-bg-medium": "#0e0e0e",
    "--ex2e-border-color": "rgba(92,69,16,0.6)",
  },
  light: {
    "--ex2e-gold-bright": "#b88a00", "--ex2e-text-primary": "#1a1008",
    "--ex2e-bg-panel": "#ddd0a8", "--ex2e-bg-medium": "#e8dcc0",
    "--ex2e-border-color": "rgba(120,90,20,0.45)",
  },
};

function setTheme(light) { document.body.classList.toggle("ex2e-light-mode", light); }

/** Assert the given tokens resolve to EXPECTED[theme] on `el`, both themes. */
function assertTokens(assert, el, tokens, label) {
  for (const theme of ["dark", "light"]) {
    setTheme(theme === "light");
    const cs = getComputedStyle(el);
    for (const tk of tokens) {
      const got = norm(cs.getPropertyValue(tk));
      assert.equal(got, norm(EXPECTED[theme][tk]), `[STYLE] ${label} ${tk} resolves in ${theme}`);
    }
  }
}

export function registerComputedStyles(context) {
  const { describe, it, assert, before, beforeEach, afterEach } = context;

  describe("Computed styles (token resolution)", () => {
    let origLight;
    before(() => assertTestWorld());
    beforeEach(() => { origLight = document.body.classList.contains("ex2e-light-mode"); });
    afterEach(async () => { setTheme(origLight); await sweep(); });

    // Character sheet: assert only exalt-INDEPENDENT tokens (gold/border-color are
    // overridden per exalt-type on character sheets; text/bg are theme-only).
    it("[STYLE] character sheet — text/bg tokens resolve (dark+light)", async () => {
      const actor = await createTempCharacter({ name: "Q-STYLE-char" });
      await actor.sheet.render(true);
      await waitFor(() => actor.sheet.rendered && !!actor.sheet.element);
      try {
        const el = actor.sheet.element;
        assertTokens(assert, el, ["--ex2e-text-primary", "--ex2e-bg-panel", "--ex2e-bg-medium"], "character");
        // Consumption: themed text color is actually applied (not the browser default).
        setTheme(false);
        const color = getComputedStyle(el).color;
        assert.ok(color && color !== "rgb(0, 0, 0)", "[STYLE] character text color is themed");
      } finally { await actor.sheet.close(); }
    });

    // NPC sheet: no exalt override -> :root gold/border-color apply.
    it("[STYLE] npc sheet — gold/text/bg/border tokens resolve (dark+light)", async () => {
      const actor = await Actor.create({ name: "Q-STYLE-npc", type: "npc" });
      register(actor);
      await actor.sheet.render(true);
      await waitFor(() => actor.sheet.rendered && !!actor.sheet.element);
      try {
        assertTokens(assert, actor.sheet.element,
          ["--ex2e-gold-bright", "--ex2e-text-primary", "--ex2e-bg-panel", "--ex2e-border-color"], "npc");
      } finally { await actor.sheet.close(); }
    });

    // Dialog: no exalt override -> :root applies.
    it("[STYLE] roll dialog — gold/text/border tokens resolve (dark+light)", async () => {
      const dlg = new GmRollPoolDialog({ description: "", difficulty: 7 }, () => {});
      await dlg.render(true);
      await waitFor(() => dlg.rendered && !!dlg.element);
      try {
        assertTokens(assert, dlg.element,
          ["--ex2e-gold-bright", "--ex2e-text-primary", "--ex2e-border-color"], "roll-dialog");
      } finally { await dlg.close(); }
    });
  });
}
