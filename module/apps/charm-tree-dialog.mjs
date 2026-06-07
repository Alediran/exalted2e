import { matchesFilter, deduplicateCharms, buildTree, splitIntoBranches, getCharmState, getPipData, getVirtualNodeState } from '../helpers/charm-tree-builder.mjs';
import { renderTree, drawConnectors, alignRowsToParents } from '../helpers/charm-tree-renderer.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class CharmTreeDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'ex2e-charm-tree',
    classes: ['exalted2e', 'charm-tree-dialog'],
    position: { width: 920, height: 700 },
    window: { title: 'EX2E.CharmTree.Title', resizable: true },
    actions: {},
  };

  static PARTS = {
    content: {
      template: 'systems/exalted2e/templates/dialog/charm-tree-dialog.hbs',
    },
  };

  // ── instance state ────────────────────────────────────────────────────────

  #actor      = null;
  #exaltType  = null;
  #groupKey   = null;
  #sources    = { systemPack: true, worldPacks: true, worldItems: true };
  #treeData   = null;
  #nodeEls    = null;
  #svgEl      = null;
  #resizeObserver = null;
  #renderGeneration = 0;
  #branches = [];
  #currentBranch = 0;

  constructor(options = {}, { actor, exaltType, groupKey } = {}) {
    super(options);
    this.#actor     = actor ?? null;
    this.#exaltType = exaltType ?? null;
    this.#groupKey  = groupKey ?? null;
  }

  // ── static factory ────────────────────────────────────────────────────────

  static open({ actor, exaltType, groupKey } = {}) {
    const dialog = new CharmTreeDialog({}, { actor, exaltType, groupKey });
    dialog.render({ force: true });
    return dialog;
  }

  // ── context ───────────────────────────────────────────────────────────────

  async _prepareContext(_options) {
    const EX2E = game.exalted2e.EX2E;

    if (!this.#exaltType) this.#exaltType = 'solar';

    // Exalt type options — [label, key] pairs (template uses pair.[0] for display, pair.[1] for value)
    const exaltTypes = [
      [game.i18n.localize('EX2E.ExaltSolar'),       'solar'],
      [game.i18n.localize('EX2E.ExaltLunar'),       'lunar'],
      [game.i18n.localize('EX2E.ExaltTerrestrial'), 'terrestrial'],
      [game.i18n.localize('EX2E.ExaltSidereal'),    'sidereal'],
      [game.i18n.localize('EX2E.ExaltAbyssal'),     'abyssal'],
      [game.i18n.localize('EX2E.ExaltInfernal'),    'infernal'],
      [game.i18n.localize('EX2E.ExaltAlchemical'),  'alchemical'],
      [game.i18n.localize('EX2E.ExaltMartialArts'), 'martialarts'],
    ];

    // Group options: [{ label: string|null, options: [[label,key],…] }]
    // null label → flat <option> list; string label → <optgroup>
    const groupOptions = await this.#buildGroupOptions(EX2E);

    if (!this.#groupKey && groupOptions.length) {
      this.#groupKey = groupOptions[0].options[0]?.[1] ?? null;
    }

    return {
      exaltTypes,
      groupOptions,
      selectedExaltType: this.#exaltType ?? '',
      selectedGroupKey:  this.#groupKey  ?? '',
      sources: this.#sources,
      showPrompt: !this.#exaltType || !this.#groupKey,
      noCharms:   false,
    };
  }

  async #buildGroupOptions(EX2E) {
    const et = this.#exaltType;
    if (!et) return [];

    if (et === 'infernal') {
      const opts = Object.entries(EX2E.yoziPatrons ?? {})
        .map(([k, v]) => [game.i18n.localize(v), k]);
      return [{ label: null, options: opts }];
    }
    if (et === 'lunar' || et === 'alchemical') {
      const flat = Object.values(EX2E.attributes ?? {})
        .flatMap(group => Object.entries(group));
      const opts = flat.map(([k, v]) => [game.i18n.localize(v), k]);
      return [{ label: null, options: opts }];
    }
    if (et === 'martialarts') {
      // Collect style name → tier; first entry wins (all charms in a style share the same tier)
      const styleTier = new Map();
      const maPack = game.packs.get('exalted2e.martialarts');
      if (maPack) {
        const index = await maPack.getIndex({
          fields: ['system.martialArtsStyleName', 'system.martialArtsTier', 'type'],
        });
        for (const entry of index) {
          if (entry.type === 'charm' && entry.system?.martialArtsStyleName) {
            const name = entry.system.martialArtsStyleName;
            if (!styleTier.has(name)) styleTier.set(name, entry.system?.martialArtsTier ?? '');
          }
        }
      }
      for (const item of game.items) {
        if (item.type === 'charm' && item.system?.martialArtsStyleName) {
          const name = item.system.martialArtsStyleName;
          if (!styleTier.has(name)) styleTier.set(name, item.system?.martialArtsTier ?? '');
        }
      }

      const TIER_ORDER  = ['terrestrial', 'celestial', 'sidereal'];
      const TIER_LABELS = { terrestrial: 'Terrestrial', celestial: 'Celestial', sidereal: 'Sidereal' };

      const byTier = new Map(TIER_ORDER.map(t => [t, []]));
      const other  = [];
      for (const [name, tier] of styleTier) {
        if (byTier.has(tier)) byTier.get(tier).push(name);
        else other.push(name);
      }

      const groups = [];
      for (const tier of TIER_ORDER) {
        const styles = byTier.get(tier).sort();
        if (styles.length) groups.push({ label: TIER_LABELS[tier], options: styles.map(n => [n, n]) });
      }
      if (other.length) groups.push({ label: 'Other', options: other.sort().map(n => [n, n]) });
      return groups;
    }
    // Solar, DB, Sidereal, Abyssal → abilities
    const opts = (EX2E.abilities ?? [])
      .map(k => [game.i18n.localize(EX2E.abilityLabels?.[k] ?? k), k]);
    return [{ label: null, options: opts }];
  }

  // ── render ────────────────────────────────────────────────────────────────

  _onRender(context, options) {
    super._onRender?.(context, options);

    const html = this.element;

    // Exalt type dropdown
    const exaltSelect = html.querySelector('select[name="exaltType"]');
    if (exaltSelect) {
      if (this.#exaltType) exaltSelect.value = this.#exaltType;
      exaltSelect.addEventListener('change', (ev) => {
        this.#exaltType = ev.target.value;
        this.#groupKey  = null;
        this.render({ force: true });
      });
    }

    // Group dropdown
    const groupSelect = html.querySelector('select[name="groupKey"]');
    if (groupSelect) {
      if (this.#groupKey) groupSelect.value = this.#groupKey;
      groupSelect.addEventListener('change', (ev) => {
        this.#groupKey = ev.target.value;
        if (this.#exaltType && this.#groupKey) this.#loadAndRenderTree();
      });
    }

    // Source toggles
    for (const cb of html.querySelectorAll('input[type="checkbox"][name^="source"]')) {
      cb.addEventListener('change', () => {
        this.#sources.systemPack  = html.querySelector('input[name="sourceSystemPack"]')?.checked ?? true;
        this.#sources.worldPacks  = html.querySelector('input[name="sourceWorldPacks"]')?.checked ?? true;
        this.#sources.worldItems  = html.querySelector('input[name="sourceWorldItems"]')?.checked ?? true;
        if (this.#exaltType && this.#groupKey) this.#loadAndRenderTree();
      });
    }


    // Card click delegation
    html.addEventListener('click', (ev) => {
      // Learn button inside a card — purchase logic, don't also open the sheet
      if (ev.target.closest('[data-action="learnCharm"]')) {
        ev.stopPropagation();
        const card = ev.target.closest('.charm-tree-card');
        if (!card) return;
        const node = this.#treeData?.nodes?.get(card.dataset.nodeId);
        if (!node) return;
        this.#onLearnCharm(ev, node.charm, node.cardState ?? 'available');
        return;
      }

      // Card click → always open charm sheet
      const card = ev.target.closest('.charm-tree-card');
      if (!card) return;
      const node = this.#treeData?.nodes?.get(card.dataset.nodeId);
      if (!node || node.isVirtual) return;
      this.#onCardClick(node);
    });

    // If pre-loaded with exaltType + groupKey, render tree immediately
    if (this.#exaltType && this.#groupKey) {
      this.#loadAndRenderTree();
    }
  }

  // ── tree loading ──────────────────────────────────────────────────────────

  async #loadAndRenderTree() {
    const gen = ++this.#renderGeneration;

    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;

    const charms = await this.#loadCharms();
    if (gen !== this.#renderGeneration) return;
    const body = this.element?.querySelector('#charm-tree-body');
    if (!body) return;

    if (!charms.length) {
      this.element?.querySelector('.charm-tree-branch-nav')?.remove();
      body.innerHTML = `<p class="charm-tree-empty">${game.i18n.localize('EX2E.CharmTree.NoCharms')}</p>`;
      return;
    }

    const treeData = buildTree(charms, this.#groupKey);

    // Attach cardState + pipData to every node before splitting into branches
    for (const node of treeData.nodes.values()) {
      if (node.isVirtual) {
        node.cardState = getVirtualNodeState(node, this.#actor);
        continue;
      }
      const charm = node.charm;
      node.cardState = getCharmState(charm, this.#actor);
      const uid = charm.system?.charmUid;
      const ownedItem = uid && this.#actor
        ? this.#actor.items.find(i => i.type === 'charm' && i.system?.charmUid === uid)
        : null;
      node.pipData = getPipData(charm, ownedItem ?? null);
    }

    this.#branches = splitIntoBranches(treeData);
    this.#currentBranch = 0;
    this.#renderBranch(0);
  }

  #renderBranch(index) {
    const branch = this.#branches[index];
    if (!branch) return;
    this.#currentBranch = index;
    this.#treeData = branch;

    const body = this.element?.querySelector('#charm-tree-body');
    if (!body) return;

    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;

    const EX2E = game.exalted2e.EX2E;
    this.#nodeEls = renderTree(body, branch, this.#exaltType, EX2E.splatPipColor, EX2E.splatLightColor);

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'charm-tree-svg');
    body.appendChild(svgEl);
    this.#svgEl = svgEl;

    const redrawConnectors = () => {
      alignRowsToParents(body, branch.edges, this.#nodeEls);
      drawConnectors(svgEl, body, branch.edges, this.#nodeEls);
    };
    requestAnimationFrame(redrawConnectors);
    this.#resizeObserver = new ResizeObserver(() => requestAnimationFrame(redrawConnectors));
    this.#resizeObserver.observe(body);

    this.#updateBranchNav();
  }

  #updateBranchNav() {
    const root = this.element?.querySelector('.charm-tree-root');
    if (!root) return;

    root.querySelector('.charm-tree-branch-nav')?.remove();
    if (this.#branches.length <= 1) return;

    const i     = this.#currentBranch;
    const total = this.#branches.length;

    const nav = document.createElement('div');
    nav.className = 'charm-tree-branch-nav';

    const makeBtn = (text, disabled, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'charm-tree-branch-nav__btn';
      btn.textContent = text;
      btn.disabled = disabled;
      btn.addEventListener('click', onClick);
      return btn;
    };

    const counter = document.createElement('span');
    counter.className = 'charm-tree-branch-nav__label';
    counter.textContent = `${i + 1} / ${total}`;

    nav.append(
      makeBtn('«', i === 0,         () => this.#renderBranch(0)),
      makeBtn('‹', i === 0,         () => this.#renderBranch(this.#currentBranch - 1)),
      counter,
      makeBtn('›', i === total - 1, () => this.#renderBranch(this.#currentBranch + 1)),
      makeBtn('»', i === total - 1, () => this.#renderBranch(total - 1)),
    );
    root.insertBefore(nav, root.querySelector('#charm-tree-body'));
  }

  async #loadCharms() {
    const et = this.#exaltType;
    const gk = this.#groupKey;
    if (!et || !gk) return [];

    const entries = [];

    // System pack — MA charms are in a separate pack from regular charms
    if (this.#sources.systemPack) {
      const packId = et === 'martialarts' ? 'exalted2e.martialarts' : 'exalted2e.charms';
      const pack = game.packs.get(packId);
      if (pack) {
        const docs = await pack.getDocuments({ type: 'charm' });
        for (const doc of docs) {
          if (matchesFilter(doc, et, gk)) {
            entries.push({ charm: doc, priority: 0 });
          }
        }
      }
    }

    // World packs
    if (this.#sources.worldPacks) {
      for (const pack of game.packs) {
        if (pack.metadata.packageType !== 'world') continue;
        if (pack.metadata.type !== 'Item') continue;
        const docs = await pack.getDocuments();
        for (const doc of docs) {
          if (doc.type === 'charm' && matchesFilter(doc, et, gk)) {
            entries.push({ charm: doc, priority: 1 });
          }
        }
      }
    }

    // World items
    if (this.#sources.worldItems) {
      for (const item of game.items) {
        if (item.type === 'charm' && matchesFilter(item, et, gk)) {
          entries.push({ charm: item, priority: 2 });
        }
      }
    }

    return deduplicateCharms(entries);
  }

  // ── card interaction ──────────────────────────────────────────────────────

  #onCardClick(node) {
    const charm = node.charm;

    // For owned charms, open the actor's copy; otherwise open the source item sheet
    if (node.cardState === 'owned' && this.#actor) {
      const uid = charm.system?.charmUid;
      const actorItem = uid
        ? this.#actor.items.find(i => i.type === 'charm' && i.system?.charmUid === uid)
        : null;
      if (actorItem) { actorItem.sheet.render(true); return; }
    }

    fromUuid(charm.uuid).then(item => item?.sheet?.render(true)).catch(() => {});
  }


  async #onLearnCharm(_ev, charm, state) {
    if (!this.#actor) return;

    const xpCost = charm.system?.purchaseXp ?? 0;
    const uid = charm.system?.charmUid ?? charm.id;

    if (state === 'purchasable' && xpCost > 0) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('EX2E.CharmTree.Learn') },
        content: `<p>Spend ${xpCost} XP to learn ${charm.name}?</p>`,
      });
      if (!confirmed) return;
    }

    const itemData = charm.toObject();
    delete itemData._id;
    await this.#actor.createEmbeddedDocuments('Item', [itemData]);

    // Log XP if purchasable (ST/owner only)
    if (state === 'purchasable' && xpCost > 0 && (game.user.isGM || this.#actor.isOwner)) {
      const log = foundry.utils.deepClone(this.#actor.system.purchaseLog ?? []);
      log.push({
        timestamp: Date.now(),
        userId:    game.user.id,
        userName:  game.user.name,
        traitPath: `charm.${uid}`,
        traitLabel: charm.name,
        oldValue:  0,
        newValue:  1,
        xpCost,
        note: game.i18n.localize('EX2E.CharmTree.Learn'),
      });
      await this.#actor.update({ 'system.purchaseLog': log });
    }

    this.#loadAndRenderTree();
  }
}
