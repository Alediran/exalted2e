import { assertTestWorld }   from './_helpers/world.mjs';
import { sweep }            from './_helpers/cleanup.mjs';
import { createTempCharacter } from './_helpers/actors.mjs';
import { CharmTreeDialog }  from '../../module/apps/charm-tree-dialog.mjs';
import {
  buildTree,
  getCharmState,
  deduplicateCharms,
} from '../../module/helpers/charm-tree-builder.mjs';

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Poll until `predicate` returns truthy or `timeoutMs` elapses.
 */
async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Create a minimal plain-object charm (not a Foundry Item) suitable for
 * passing to builder functions that accept plain objects.
 * buildTree / getCharmState access `charm.system.*` and `charm.id`.
 */
function makePlainCharm(overrides = {}) {
  return foundry.utils.mergeObject(
    {
      id: foundry.utils.randomID(),
      name: 'Test Charm',
      system: {
        charmUid: '',
        exaltType: 'solar',
        ability: 'melee',
        essence: 1,
        minAbility: 1,
        prereqGroups: [],
      },
    },
    overrides,
    { inplace: false }
  );
}

// ─── Batch 1: builder unit tests ─────────────────────────────────────────────

export function registerCharmTreeBuilder(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe('Charm Tree Builder', function () {
    before(assertTestWorld);
    afterEach(sweep);

    // ── deduplicateCharms ────────────────────────────────────────────────────

    it('deduplicateCharms: world item wins over same charmUid in pack', async function () {
      const uid = 'solar.melee.test-charm';
      const packCharm  = makePlainCharm({ system: { charmUid: uid } });
      const worldCharm = makePlainCharm({ system: { charmUid: uid } });

      const result = deduplicateCharms([
        { charm: packCharm,  priority: 0 },  // system pack
        { charm: worldCharm, priority: 2 },  // world item
      ]);

      assert.equal(result.length, 1, 'only one charm after dedup');
      assert.strictEqual(result[0], worldCharm, 'world item wins over pack');
    });

    it('deduplicateCharms: charms without a charmUid are always kept', async function () {
      const a = makePlainCharm({ system: { charmUid: '' } });
      const b = makePlainCharm({ system: { charmUid: '' } });

      // Charms with no uid bypass dedup logic — both should pass through.
      const result = deduplicateCharms([
        { charm: a, priority: 0 },
        { charm: b, priority: 0 },
      ]);

      // Per the implementation, no-uid charms are appended *after* uid-dedup map.
      // Both must be present.
      assert.equal(result.length, 2, 'both no-uid charms retained');
    });

    // ── buildTree ────────────────────────────────────────────────────────────

    it('buildTree: linear chain produces correct tiers', async function () {
      const uidA = 'solar.melee.charm-a';
      const uidB = 'solar.melee.charm-b';
      const uidC = 'solar.melee.charm-c';

      const charmA = makePlainCharm({
        system: {
          charmUid: uidA,
          prereqGroups: [],
        },
      });
      const charmB = makePlainCharm({
        system: {
          charmUid: uidB,
          // prereqGroups: one group, one alternative of type 'charm' pointing at A
          prereqGroups: [
            { alternatives: [{ type: 'charm', charmUid: uidA }] },
          ],
        },
      });
      const charmC = makePlainCharm({
        system: {
          charmUid: uidC,
          prereqGroups: [
            { alternatives: [{ type: 'charm', charmUid: uidB }] },
          ],
        },
      });

      const { nodes } = buildTree([charmA, charmB, charmC]);

      const nodeA = nodes.get(uidA);
      const nodeB = nodes.get(uidB);
      const nodeC = nodes.get(uidC);

      assert.ok(nodeA, 'node A exists');
      assert.ok(nodeB, 'node B exists');
      assert.ok(nodeC, 'node C exists');
      assert.equal(nodeA.tier, 0, 'A is tier 0');
      assert.equal(nodeB.tier, 1, 'B is tier 1');
      assert.equal(nodeC.tier, 2, 'C is tier 2');
    });

    it('buildTree: virtual anyExcellency node synthesised at tier 0', async function () {
      const charmUid = 'solar.melee.charm-exc-dep';
      const charm = makePlainCharm({
        system: {
          charmUid,
          ability: 'melee',
          prereqGroups: [
            { alternatives: [{ type: 'anyExcellency', abilityKey: 'melee' }] },
          ],
        },
      });

      const { nodes } = buildTree([charm]);

      const virtualId = 'virtual:anyExcellency:melee';
      const virtualNode = nodes.get(virtualId);

      assert.ok(virtualNode, 'virtual anyExcellency node exists');
      assert.equal(virtualNode.isVirtual, true, 'node is marked virtual');
      assert.equal(virtualNode.tier, 0, 'virtual node is at tier 0');
    });

    it('buildTree: charm depending on anyExcellency is at tier 1', async function () {
      const charmUid = 'solar.archery.charm-exc';
      const charm = makePlainCharm({
        system: {
          charmUid,
          ability: 'archery',
          prereqGroups: [
            { alternatives: [{ type: 'anyExcellency', abilityKey: 'archery' }] },
          ],
        },
      });

      const { nodes } = buildTree([charm]);

      const charmNode = nodes.get(charmUid);
      assert.ok(charmNode, 'charm node exists');
      assert.equal(charmNode.tier, 1, 'charm depending on excellency is tier 1');
    });

    // ── getCharmState ────────────────────────────────────────────────────────

    it('getCharmState: returns neutral when actor is null', async function () {
      const charm = makePlainCharm({ system: { charmUid: 'solar.melee.neutral-test', essence: 1 } });
      const state = getCharmState(charm, null);
      assert.equal(state, 'neutral');
    });

    it('getCharmState: returns owned when actor has the charm at maxPurchases', async function () {
      const uid = 'solar.melee.owned-test';
      const charm = makePlainCharm({
        system: { charmUid: uid, essence: 1, minAbility: 0, prereqGroups: [], maxPurchases: '1' },
      });

      const actor = await createTempCharacter({ name: 'Charm State Owner' });
      // Give actor enough essence so no other gates fire
      await actor.update({ 'system.essence.value': 3 });

      // Embed the charm on the actor so it counts as owned
      await actor.createEmbeddedDocuments('Item', [{
        name: charm.name,
        type: 'charm',
        system: { ...charm.system, purchaseLevel: 1 },
      }]);

      const state = getCharmState(charm, actor);
      assert.equal(state, 'owned', 'actor who has the charm at maxPurchases → owned');
    });

    it('getCharmState: returns locked when essence too low', async function () {
      const charm = makePlainCharm({
        system: {
          charmUid: 'solar.melee.essence-locked',
          essence: 3,
          minAbility: 0,
          prereqGroups: [],
        },
      });
      const actor = await createTempCharacter({ name: 'Low Essence Actor' });
      await actor.update({ 'system.essence.value': 1 });

      const state = getCharmState(charm, actor);
      assert.equal(state, 'locked', 'actor with essence 1 cannot meet essence 3 requirement');
    });
  });
}

// ─── Batch 2: dialog integration tests ───────────────────────────────────────

export function registerCharmTreeDialogIntegration(context) {
  const { describe, it, before, afterEach, assert } = context;

  let dialog = null;

  /** Close and null out the dialog between tests. */
  async function closeDialog() {
    if (dialog) {
      try { await dialog.close(); } catch (_) { /* ignore */ }
      dialog = null;
    }
  }

  describe('CharmTreeDialog integration', function () {
    before(assertTestWorld);
    afterEach(async function () {
      await closeDialog();
      await sweep();
    });

    it('opens without actor and renders into DOM', async function () {
      dialog = CharmTreeDialog.open();
      // The dialog should render asynchronously; wait for its element to appear.
      const appeared = await waitFor(
        () => !!dialog.element && document.contains(dialog.element),
        { timeoutMs: 3000 }
      );
      assert.ok(appeared, 'dialog element is in the DOM after open()');
    });

    it('no-actor, no filter → shows prompt state (no tree body charms)', async function () {
      dialog = CharmTreeDialog.open();
      await waitFor(() => !!dialog.element && document.contains(dialog.element), { timeoutMs: 3000 });

      const body = dialog.element?.querySelector('#charm-tree-body');
      // When neither exaltType nor groupKey is set the body stays in prompt state
      // (no charms loaded). The body either doesn't exist yet or is empty.
      if (body) {
        // It should not contain any charm cards (a tree was not rendered)
        const cards = body.querySelectorAll('.charm-tree-card');
        assert.equal(cards.length, 0, 'no charm cards rendered without a filter selection');
      } else {
        assert.ok(true, 'dialog renders prompt state without a tree body — no charm cards present');
      }
    });

    it('pre-loaded with exaltType + groupKey sets selects to correct values', async function () {
      dialog = CharmTreeDialog.open({ exaltType: 'solar', groupKey: 'archery' });
      const rendered = await waitFor(
        () => {
          if (!dialog.element || !document.contains(dialog.element)) return false;
          const sel = dialog.element.querySelector('select[name="exaltType"]');
          return sel && sel.value === 'solar';
        },
        { timeoutMs: 3000 }
      );
      assert.ok(rendered, 'dialog rendered with exaltType pre-selected');

      const exaltSelect = dialog.element.querySelector('select[name="exaltType"]');
      const groupSelect = dialog.element.querySelector('select[name="groupKey"]');

      assert.equal(exaltSelect?.value, 'solar',   'exalt type select has value "solar"');
      assert.equal(groupSelect?.value, 'archery', 'group select has value "archery"');
    });

    // TEMP (CI diagnostic): commented out to confirm whether this skipped test
    // is the phantom "1 failed" in the headless runner. Restore after verifying.
    // it('source toggle: requires world charm pack setup', async function () {
    //   this.skip();
    // });
  });
}
