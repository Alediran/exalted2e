import { matchesFilter, deduplicateCharms, buildTree, getCharmState, getPipData, getVirtualNodeState } from '../helpers/charm-tree-builder.mjs';
import { renderTree, drawConnectors } from '../helpers/charm-tree-renderer.mjs';
import { evaluateCharmPrereqs } from '../helpers/charm-prereqs.mjs';

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
  #activePanel = null; // charmUid of currently open detail panel, or null
  #renderGeneration = 0;

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

    // Group options based on selected exalt type — also [label, key] pairs
    const groupOptions = await this.#buildGroupOptions(EX2E);

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
      // yoziPatrons values are i18n keys
      return Object.entries(EX2E.yoziPatrons ?? {})
        .map(([k, v]) => [game.i18n.localize(v), k]);
    }
    if (et === 'lunar' || et === 'alchemical') {
      // attributes is a nested {physical:{strength:"i18n",...},...} — flatten it
      const flat = Object.values(EX2E.attributes ?? {})
        .flatMap(group => Object.entries(group));
      return flat.map(([k, v]) => [game.i18n.localize(v), k]);
    }
    if (et === 'martialarts') {
      // Derive style names from martialArtsStyleName on charm items in the MA pack
      const styleNames = new Set();
      const maPack = game.packs.get('exalted2e.martialarts');
      if (maPack) {
        const index = await maPack.getIndex({ fields: ['system.martialArtsStyleName', 'type'] });
        for (const entry of index) {
          if (entry.type === 'charm' && entry.system?.martialArtsStyleName) {
            styleNames.add(entry.system.martialArtsStyleName);
          }
        }
      }
      // Also pick up styles from world items and actor items
      for (const item of game.items) {
        if (item.type === 'charm' && item.system?.martialArtsStyleName) {
          styleNames.add(item.system.martialArtsStyleName);
        }
      }
      return Array.from(styleNames).sort().map(n => [n, n]);
    }
    // Solar, DB, Sidereal, Abyssal → abilities (EX2E.abilities is an array of keys)
    return (EX2E.abilities ?? [])
      .map(k => [game.i18n.localize(EX2E.abilityLabels?.[k] ?? k), k]);
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
        this.#activePanel = null;
        this.render({ force: true });
      });
    }

    // Group dropdown
    const groupSelect = html.querySelector('select[name="groupKey"]');
    if (groupSelect) {
      if (this.#groupKey) groupSelect.value = this.#groupKey;
      groupSelect.addEventListener('change', (ev) => {
        this.#groupKey = ev.target.value;
        this.#activePanel = null;
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

    // Detail panel close button
    html.querySelector('[data-action="closePanel"]')
      ?.addEventListener('click', () => this.#hideDetailPanel());

    // Card click delegation
    html.addEventListener('click', (ev) => {
      const card = ev.target.closest('.charm-tree-card');
      if (!card) return;
      const nodeId = card.dataset.nodeId;
      const node = this.#treeData?.nodes?.get(nodeId);
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

    // Disconnect any previous resize observer before rebuilding the tree
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;

    const charms = await this.#loadCharms();
    if (gen !== this.#renderGeneration) return;
    const body = this.element?.querySelector('#charm-tree-body');
    if (!body) return;

    if (!charms.length) {
      body.innerHTML = `<p class="charm-tree-empty">${game.i18n.localize('EX2E.CharmTree.NoCharms')}</p>`;
      return;
    }

    const treeData = buildTree(charms, this.#groupKey);

    // Attach cardState + pipData to each node
    const EX2E = game.exalted2e.EX2E;
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

    this.#treeData = treeData;

    // Render tier rows — renderTree clears containerEl.innerHTML internally
    this.#nodeEls = renderTree(
      body,
      treeData,
      this.#exaltType,
      EX2E.splatPipColor,
      EX2E.splatLightColor
    );

    // Append SVG overlay AFTER renderTree so it isn't wiped by its innerHTML clear
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'charm-tree-svg');
    body.appendChild(svgEl);
    this.#svgEl = svgEl;

    const redrawConnectors = () => {
      drawConnectors(svgEl, body, treeData.edges, this.#nodeEls);
    };

    // Draw connectors after layout, then re-draw on every resize
    requestAnimationFrame(redrawConnectors);

    this.#resizeObserver = new ResizeObserver(() => requestAnimationFrame(redrawConnectors));
    this.#resizeObserver.observe(body);
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
    const state = node.cardState ?? 'neutral';

    if (state === 'locked') return;

    if (!this.#actor || state === 'neutral') {
      fromUuid(charm.uuid).then(item => item?.sheet?.render(true)).catch(() => {});
      return;
    }

    if (state === 'owned') {
      const uid = charm.system?.charmUid;
      const actorItem = uid
        ? this.#actor.items.find(i => i.type === 'charm' && i.system?.charmUid === uid)
        : null;
      if (actorItem) actorItem.sheet.render(true);
      return;
    }

    // purchasable or available → toggle detail panel
    const uid = charm.system?.charmUid ?? charm.id;
    if (this.#activePanel === uid) {
      this.#hideDetailPanel();
    } else {
      this.#showDetailPanel(node);
    }
  }

  #showDetailPanel(node) {
    const charm = node.charm;
    const state = node.cardState;
    const EX2E = game.exalted2e.EX2E;
    const uid = charm.system?.charmUid ?? charm.id;
    this.#activePanel = uid;

    const panel = this.element.querySelector('#charm-tree-detail');
    const bodyEl = panel?.querySelector('.charm-tree-detail__body');
    if (!panel || !bodyEl) return;

    const pipColor = EX2E.splatPipColor?.[this.#exaltType] ?? '#888';

    // evaluateCharmPrereqs returns Array<{ group, index, satisfied, label }>
    // Normalise to { label, met } for rendering.
    const prereqLines = evaluateCharmPrereqs(charm, this.#actor)
      .map(r => ({ label: r.label, met: r.satisfied }));

    const xpCost = charm.system?.purchaseXp ?? 0;
    const ownedItem = this.#actor?.items.find(i => i.type === 'charm' && i.system?.charmUid === uid) ?? null;
    const maxPurch  = parseInt(charm.system?.maxPurchases ?? '1', 10) || 1;
    const ownedLevel = ownedItem?.system?.purchaseLevel ?? 0;
    const isMulti   = maxPurch > 1;
    const learnLabel = (isMulti && ownedLevel > 0)
      ? game.i18n.localize('EX2E.CharmTree.LearnAgain')
      : game.i18n.localize('EX2E.CharmTree.Learn');

    // Build DOM safely — no innerHTML with user data
    bodyEl.innerHTML = '';

    const img = document.createElement('img');
    img.className = 'charm-tree-detail__icon';
    img.setAttribute('src', charm.img ?? '');
    img.alt = '';
    bodyEl.appendChild(img);

    const info = document.createElement('div');
    info.className = 'charm-tree-detail__info';

    const nameEl = document.createElement('div');
    nameEl.className = 'charm-tree-detail__name';
    nameEl.textContent = charm.name;
    info.appendChild(nameEl);

    const costsEl = document.createElement('div');
    costsEl.className = 'charm-tree-detail__costs';
    costsEl.textContent = xpCost > 0 ? `XP: ${xpCost}` : '';
    info.appendChild(costsEl);

    const prereqsEl = document.createElement('div');
    prereqsEl.className = 'charm-tree-detail__prereqs';
    for (const line of prereqLines) {
      const lineEl = document.createElement('div');
      lineEl.className = line.met ? 'charm-tree-detail__prereq-met' : 'charm-tree-detail__prereq-unmet';
      lineEl.textContent = `${line.met ? '✓' : '✗'} ${line.label}`;
      prereqsEl.appendChild(lineEl);
    }
    info.appendChild(prereqsEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'charm-tree-detail__actions';

    const learnBtn = document.createElement('button');
    learnBtn.type = 'button';
    learnBtn.className = 'charm-tree-learn-btn';
    learnBtn.dataset.charmId = charm.id;
    learnBtn.dataset.charmUuid = charm.uuid;
    learnBtn.dataset.state = state;
    learnBtn.style.borderColor = pipColor;
    learnBtn.textContent = learnLabel;
    learnBtn.addEventListener('click', (ev) => {
      this.#onLearnCharm(ev, charm, state);
    });
    actionsEl.appendChild(learnBtn);
    info.appendChild(actionsEl);

    bodyEl.appendChild(info);
    panel.style.display = '';
  }

  #hideDetailPanel() {
    this.#activePanel = null;
    const panel = this.element.querySelector('#charm-tree-detail');
    if (panel) panel.style.display = 'none';
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

    this.#hideDetailPanel();
    this.#loadAndRenderTree();
  }
}
