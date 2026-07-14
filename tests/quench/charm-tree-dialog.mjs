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

    it('[CTREE] rendered nodes are absolutely positioned and the container is sized to fit', async function () {
      this.timeout(10000);  // dialogs + tree render can take time
      dialog = CharmTreeDialog.open({ exaltType: 'solar', groupKey: 'melee' });
      await waitFor(() => !!dialog.element && document.contains(dialog.element), { timeoutMs: 3000 });

      const body = dialog.element?.querySelector('#charm-tree-body');
      assert.ok(body, 'tree body element exists');

      // Wait for the tree to actually render nodes. If the test world has no
      // melee charms loaded, skip rather than fail (pack contents are dev-only).
      const rendered = await waitFor(
        () => body.querySelectorAll('[data-node-id]').length > 1,
        { timeoutMs: 3000 }
      );
      if (!rendered) this.skip();

      const cards = [...body.querySelectorAll('[data-node-id]')];
      assert.ok(
        cards.every(c => getComputedStyle(c).position === 'absolute'),
        'every node is absolutely positioned'
      );

      // The tree lives in a content-sized canvas; the body stays full-width so
      // the tree centres rather than pinning the viewport to the content width.
      const canvas = body.querySelector('.charm-tree-canvas');
      assert.ok(canvas, 'tree canvas exists');
      const canvasWidth = parseFloat(canvas.style.width);
      assert.ok(canvasWidth > 0, 'canvas is sized to its content');
      assert.ok(
        body.getBoundingClientRect().width >= canvasWidth - 0.5
          || body.scrollWidth >= canvasWidth - 0.5,
        'body fills the dialog (centres the tree) or scrolls to fit a wider tree'
      );
      const maxLeft = Math.max(...cards.map(c => parseFloat(c.style.left) || 0));
      assert.ok(maxLeft + 0.5 >= 0 && maxLeft <= canvasWidth, 'no node is positioned beyond the canvas width');
    });

    it('source toggle: requires world charm pack setup', async function () {
      this.skip();
    });
  });
}

// ─── Batch 3: Fair Folk dialog support ───────────────────────────────────────

export function registerCharmTreeDialogFairfolk(context) {
  const { describe, it, before, afterEach, assert } = context;

  let dialog = null;

  async function closeDialog() {
    if (dialog) {
      try { await dialog.close(); } catch (_) {}
      dialog = null;
    }
  }

  describe('CharmTreeDialog — Fair Folk support', function () {
    before(assertTestWorld);
    afterEach(async function () {
      await closeDialog();
      await sweep();
    });

    it('exalt type select contains a "fairfolk" option', async function () {
      dialog = CharmTreeDialog.open();
      await waitFor(() => !!dialog.element && document.contains(dialog.element), { timeoutMs: 3000 });

      const exaltSelect = dialog.element.querySelector('select[name="exaltType"]');
      assert.ok(exaltSelect, 'exaltType select exists');
      const ffOption = [...exaltSelect.options].find(o => o.value === 'fairfolk');
      assert.ok(ffOption, '"fairfolk" value is present in the exalt type select');
    });

    it('opening with exaltType=fairfolk and groupKey=cup pre-selects both selects', async function () {
      dialog = CharmTreeDialog.open({ exaltType: 'fairfolk', groupKey: 'cup' });
      const rendered = await waitFor(
        () => {
          if (!dialog.element || !document.contains(dialog.element)) return false;
          const sel = dialog.element.querySelector('select[name="exaltType"]');
          return sel && sel.value === 'fairfolk';
        },
        { timeoutMs: 3000 }
      );
      assert.ok(rendered, 'dialog rendered with exaltType=fairfolk pre-selected');

      const exaltSelect = dialog.element.querySelector('select[name="exaltType"]');
      const groupSelect = dialog.element.querySelector('select[name="groupKey"]');

      assert.equal(exaltSelect?.value, 'fairfolk', 'exalt select shows "fairfolk"');
      assert.equal(groupSelect?.value, 'cup',      'group select shows "cup"');
    });

    it('group select has exactly the 5 grace keys for fairfolk', async function () {
      dialog = CharmTreeDialog.open({ exaltType: 'fairfolk', groupKey: 'cup' });
      await waitFor(
        () => {
          if (!dialog.element || !document.contains(dialog.element)) return false;
          const sel = dialog.element.querySelector('select[name="exaltType"]');
          return sel && sel.value === 'fairfolk';
        },
        { timeoutMs: 3000 }
      );

      const groupSelect = dialog.element.querySelector('select[name="groupKey"]');
      assert.ok(groupSelect, 'group select exists');

      const optionValues = [...groupSelect.options].map(o => o.value);
      assert.equal(optionValues.length, 5, 'group select has exactly 5 options');
      for (const key of ['cup', 'ring', 'staff', 'sword', 'heart']) {
        assert.ok(optionValues.includes(key), `"${key}" grace option is present`);
      }
    });
  });
}
