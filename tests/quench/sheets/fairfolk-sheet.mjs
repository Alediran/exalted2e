import { register, sweep } from '../_helpers/cleanup.mjs';
import { assertTestWorld }  from '../_helpers/world.mjs';

async function createTempFairfolk(name = 'Quench FairFolk') {
  const actor = await Actor.create({ name, type: 'fairfolk' });
  return register(actor);
}

async function waitFor(predicate, { timeoutMs = 4000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

export function registerFairfolkSheet(context) {
  const { describe, it, assert, before, afterEach } = context;

  // ── Caste ability auto-assignment ──────────────────────────────────────────

  describe('Fair Folk — caste ability auto-assignment', () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it('[FFSHEET] caste=sword marks all 5 sword grace abilities as caste', async () => {
      const actor = await createTempFairfolk('FF-Caste-Sword');
      await actor.update({ 'system.caste': 'sword' });
      const ab = actor.system.abilities;
      assert.equal(ab.archery.caste,    true,  'archery is sword caste');
      assert.equal(ab.martialArts.caste,true,  'martialArts is sword caste');
      assert.equal(ab.melee.caste,      true,  'melee is sword caste');
      assert.equal(ab.presence.caste,   true,  'presence is sword caste');
      assert.equal(ab.war.caste,        true,  'war is sword caste');
      // A cup-grace ability must not be marked
      assert.equal(ab.linguistics.caste,false, 'linguistics not in sword caste');
      assert.equal(ab.occult.caste,     false, 'occult not in sword caste');
    });

    it('[FFSHEET] shadowedCaste=cup marks all 5 cup grace abilities as caste', async () => {
      const actor = await createTempFairfolk('FF-Shadow-Cup');
      await actor.update({ 'system.shadowedCaste': 'cup' });
      const ab = actor.system.abilities;
      assert.equal(ab.linguistics.caste,true,  'linguistics is cup caste');
      assert.equal(ab.occult.caste,     true,  'occult is cup caste');
      assert.equal(ab.ride.caste,       true,  'ride is cup caste');
      assert.equal(ab.socialize.caste,  true,  'socialize is cup caste');
      assert.equal(ab.thrown.caste,     true,  'thrown is cup caste');
      // A sword-grace ability must not be marked
      assert.equal(ab.melee.caste,      false, 'melee not in cup caste');
      assert.equal(ab.war.caste,        false, 'war not in cup caste');
    });

    it('[FFSHEET] caste=sword + shadowedCaste=ring produces the union of both grace sets', async () => {
      const actor = await createTempFairfolk('FF-Union');
      await actor.update({ 'system.caste': 'sword', 'system.shadowedCaste': 'ring' });
      const ab = actor.system.abilities;
      // Sword abilities
      assert.equal(ab.melee.caste,         true,  'melee (sword) in union');
      assert.equal(ab.archery.caste,        true,  'archery (sword) in union');
      // Ring abilities
      assert.equal(ab.investigation.caste,  true,  'investigation (ring) in union');
      assert.equal(ab.stealth.caste,        true,  'stealth (ring) in union');
      // Cup and heart abilities must not be present
      assert.equal(ab.linguistics.caste,    false, 'linguistics (cup) not in union');
      assert.equal(ab.athletics.caste,      false, 'athletics (heart) not in union');
    });

    it('[FFSHEET] clearing caste to empty removes all ability caste marks', async () => {
      const actor = await createTempFairfolk('FF-Clear');
      await actor.update({ 'system.caste': 'staff' });
      assert.equal(actor.system.abilities.bureaucracy.caste, true, 'staff caste initially set');

      await actor.update({ 'system.caste': '' });
      const allFalse = Object.values(actor.system.abilities).every(a => a.caste === false);
      assert.ok(allFalse, 'all ability caste flags cleared when caste is set to empty');
    });
  });

  // ── Sheet render smoke ─────────────────────────────────────────────────────

  describe('Fair Folk sheet — render smoke', () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it('[FFSHEET] sheet renders with a charms tab nav link and openCharmTree button', async () => {
      const actor = await createTempFairfolk('FF-Render');
      await actor.sheet.render(true);
      await waitFor(() => actor.sheet.rendered && !!actor.sheet.element);

      const el = actor.sheet.element;
      assert.ok(el, 'sheet element exists in the DOM');

      // Tab nav (always rendered regardless of active tab)
      const charmsTab = el.querySelector('[data-tab="charms"]');
      assert.ok(charmsTab, 'charms tab nav link is present');

      // openCharmTree button lives in the charms PARTS section; all PARTS
      // render on every render() call so it is always in the DOM.
      const treeBtn = el.querySelector('[data-action="openCharmTree"]');
      assert.ok(treeBtn, 'openCharmTree button is present in the rendered sheet');

      await actor.sheet.close();
    });
  });
}
