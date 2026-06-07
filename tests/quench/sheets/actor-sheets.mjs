import { register, sweep }       from "../_helpers/cleanup.mjs";
import { assertTestWorld }        from "../_helpers/world.mjs";
import { createTempCharacter }    from "../_helpers/actors.mjs";

// Local poll helper (headless render can be slow).
async function waitFor(predicate, { timeoutMs = 8000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

/** Actor subtypes registered by the system (excludes the abstract "base"). */
function actorSubtypes() {
  const types = game.documentTypes?.Actor ?? [];
  return types.filter(t => t && t !== "base");
}

/** Create a temp actor of any type, registered for sweep. */
async function makeActor(type) {
  if (type === "character") return createTempCharacter({ name: `Q-AS-${type}` });
  const actor = await Actor.create({ name: `Q-AS-${type}`, type });
  return register(actor);
}

export function registerActorSheets(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Actor sheets (render + round-trip)", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // One generated test per registered Actor subtype: render its sheet and
    // round-trip the name field (exercises _prepareContext / _onRender /
    // submitOnChange for character / npc / unit / vehicle).
    for (const type of actorSubtypes()) {
      it(`[ASHEET] ${type} sheet renders and round-trips its name`, async () => {
        const actor = await makeActor(type);

        await actor.sheet.render(true);
        await waitFor(() => actor.sheet.rendered && !!actor.sheet.element);
        const el = actor.sheet.element;
        assert.ok(el, `${type} sheet rendered an element`);

        // Universal field round-trip via the header name input, when present.
        const nameInput = el.querySelector("input[name='name']");
        if (nameInput) {
          const newName = `Renamed ${type}`;
          nameInput.value = newName;
          nameInput.dispatchEvent(new Event("change", { bubbles: true }));
          await waitFor(() => actor.name === newName);
          assert.equal(actor.name, newName, `${type} name round-trip via submitOnChange`);
        }

        await actor.sheet.close();
      });
    }
  });
}
