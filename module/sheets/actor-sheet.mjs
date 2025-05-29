import { prepareActiveEffectCategories } from "../helpers/effects.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class ExaltedSecondActorSheet extends HandlebarsApplicationMixin(
  ActorSheetV2
) {
  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
    this.collapseStates = {
      charm: {},
      spell: {},
    };
  }

  static DEFAULT_OPTIONS = {
    window: {
      title: "Actor Sheet",
      resizable: true,
      controls: [
        {
          icon: "fa-solid fa-question",
          label: "Help",
          action: "helpDialogue",
        },
      ],
    },
    classes: ["exalted2e", "actor"],
    dragDrop: [{ dragSelector: "[data-drag]", dropSelector: null }],
    form: {
      submitOnChange: true,
    },
    position: { width: 818, height: 1061 },
    actions: {
      onEditImage: this._onEditImage,
      dotCounterChange: this._onDotCounterChange,
    },
  };

  get title() {
    return `${game.i18n.localize(this.actor.name)}`;
  }

  get type() {
    return this.document.type;
  }

  static PARTS = {
    header: {
      classes: ["sheet-header"],
      template: `systems/exalted2e/templates/actor/actor-header.hbs`,
    },
    details: {
      classes: ["sheet-body"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/exalted2e/templates/actor/parts/actor-details.hbs",
      scrollable: [""],
    },
    charms: {
      classes: ["sheet-body"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/exalted2e/templates/actor/parts/actor-charms.hbs",
      scrollable: [""],
    },
    biography: {
      classes: ["sheet-body"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/exalted2e/templates/actor/parts/actor-biography.hbs",
      scrollable: [""],
    },
    tabs: {
      classes: ["tabs-right"],
      template: "systems/exalted2e/templates/actor/tabs.hbs",
    },
  };

  /* -------------------------------------------- */
  _initializeApplicationOptions(options) {
    options.classes = [
      //options.document.getSheetBackground(),
      "exalted2e",
      "sheet",
      "actor",
    ];
    return super._initializeApplicationOptions(options);
  }

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    /* if (game.settings.get("exalted2e", "compactSheets")) {
      options.position.height = 620;
      options.position.width = 560;
    }*/
  }

  /** @override */
  async _prepareContext(_options) {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.

    // Use a safe clone of the actor data for further operations.
    const actorData = this.document.toObject(false);

    // Default tab for first time it's rendered this session
    if (!this.tabGroups.primary) this.tabGroups.primary = "details";

    const context = {
      // Add the actor's data to context.data for easier access, as well as flags.
      isEditable: true,
      isOwner: actorData.isOwner,
      limited: actorData.limited,
      actor: actorData,
      system: actorData.system,
      flags: actorData.flags,

      // Adding a pointer to CONFIG.EXALTED2E
      config: CONFIG.EXALTED2E,
      castes: CONFIG.EXALTED2E.castes[actorData.type],
      dtypes: ["String", "Number", "Boolean"],

      tabs: [
        {
          id: "details",
          group: "primary",
          icon: "fas fa-regular fa-dice-d10",
          cssClass: `item control${
            this.tabGroups.primary === "details" ? " active" : ""
          }`,
          tooltip: `${game.i18n.localize("EXALTED2E.SheetLabels.Details")}`,
        },
        {
          id: "charms",
          group: "primary",
          icon: "fas fa-list",
          cssClass: `item control${
            this.tabGroups.primary === "charms" ? " active" : ""
          }`,
          tooltip: `${game.i18n.localize("EXALTED2E.SheetLabels.Charms")}`,
        },
        {
          id: "biography",
          group: "primary",
          icon: "fas fa-book",
          cssClass: `item control${
            this.tabGroups.primary === "biography" ? " active" : ""
          }`,
          tooltip: `${game.i18n.localize("EXALTED2E.SheetLabels.Bio")}`,
        },
      ],
      enrichedBiography:
        await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          this.actor.system.biography,
          {
            // Whether to show secret blocks in the finished html
            secrets: this.document.isOwner,
            // Data to fill in for inline rolls
            rollData: this.actor.getRollData(),
            // Relative UUID resolution
            relativeTo: this.actor,
          }
        ),
    };

    this._prepareItems(context);
    this._prepareCharacterData(context);

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    return context;
  }

  /**
   * Character-specific context modifications
   *
   * @param {object} context The context object to mutate
   */
  _prepareCharacterData(context) {
    // This is where you can enrich character-specific editor fields
    // or setup anything else that's specific to this type
    for (let [key, attr] of Object.entries(context.actor.system.attributes)) {
      attr.name = game.i18n.localize(CONFIG.EXALTED2E.attributes[key]);
    }
    for (let [key, ability] of Object.entries(context.actor.system.abilities)) {
      ability.name = CONFIG.EXALTED2E.abilities[key];
    }
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const features = [];
    const charms = [];

    // Iterate through items, allocating to containers
    for (let i of this.document.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to gear.
      if (i.type === "item") {
        gear.push(i);
      }
      // Append to features.
      else if (i.type === "feature") {
        features.push(i);
      }
      // Append to spells.
      else if (i.type === "charm") {
        if (i.system.spellLevel != undefined) {
          charms[i.system.spellLevel].push(i);
        }
      }
    }

    // Assign and return
    context.gear = gear;
    context.features = features;
    context.charms = charms;
  }

  async _preparePartContext(partId, context) {
    console.log("Part Context is ", context);
    context.tab = context.tabs.find((item) => item.id === partId);
    return context;
  }

  _prepareActorSheetData(sheetData) {
    const actorData = sheetData.actor;
  }
  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element));
    this._setupDotCounters(this.element);
    this._setupSquareCounters(this.element);
    this._setupSheetTheme();
    //this._renderTabs(context, options);
    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    /*html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on("click", ".effect-control", (ev) => {
      const row = ev.currentTarget.closest("li");
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on("click", ".rollable", this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }*/
  }

  _setupSheetTheme() {
    const html = $(this.element)[0];
    const sheetBody = html.querySelector(".sheet-body");

    html.classList.add(this.type);
    sheetBody.classList.add(this.type);
  }

  _renderTabs(context, options) {
    const html = $(this.element)[0];
    const tabs = html.querySelector(".tabs.tabs-right");

    //html.appendChild(tabs);
    return html;
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system["type"];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == "item") {
        const itemId = element.closest(".item").dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : "";
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get("core", "rollMode"),
      });
      return roll;
    }
  }

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const docRow = event.currentTarget.closest("li");
    if ("link" in event.target.dataset) return;

    // Chained operation
    let dragData = this._getEmbeddedDocument(docRow)?.toDragData();

    if (!dragData) return;

    // Set data transfer
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) {}

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data =
      foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const actor = this.actor;
    const allowed = Hooks.call("dropActorSheetData", actor, this, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case "ActiveEffect":
        return this._onDropActiveEffect(event, data);
      case "Actor":
        return this._onDropActor(event, data);
      case "Item":
        return this._onDropItem(event, data);
      case "Folder":
        return this._onDropFolder(event, data);
    }
  }

  /**
   * Returns an array of DragDrop instances
   * @type {DragDrop[]}
   */
  get dragDrop() {
    return this.#dragDrop;
  }

  // This is marked as private because there's no real need
  // for subclasses or external hooks to mess with it directly
  #dragDrop;

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new foundry.applications.ux.DragDrop.implementation(d);
    });
  }

  async _onDragSavedRoll(ev) {
    const li = ev.currentTarget;
    if (ev.target.classList.contains("content-link")) return;
    const savedRoll = this.actor.system.savedRolls[li.dataset.itemId];
    ev.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        actorId: this.actor.uuid,
        type: "savedRoll",
        id: li.dataset.itemId,
        name: savedRoll.name,
      })
    );
  }

  /**
   * Handle changing a Document's image.
   *
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const { img } =
      this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ??
      {};
    const fp = new foundry.applications.apps.FilePicker.implementation({
      current,
      type: "image",
      redirectToRoot: img ? [img] : [],
      callback: (path) => {
        this.document.update({ [attr]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10,
    });
    return fp.browse();
  }

  _assignToActorField(fields, value) {
    const actorData = foundry.utils.duplicate(this.actor);
    // update actor owned items
    if (fields.length === 2 && fields[0] === "items") {
      for (const i of actorData.items) {
        if (fields[1] === i._id) {
          i.data.points = value;
          break;
        }
      }
    } else {
      const lastField = fields.pop();
      if (
        fields.reduce((data, field) => data[field], actorData)[lastField] ===
          1 &&
        value === 1
      ) {
        fields.reduce((data, field) => data[field], actorData)[lastField] = 0;
      } else {
        fields.reduce((data, field) => data[field], actorData)[lastField] =
          value;
      }
    }
    this.actor.update(actorData);
  }

  static _onDotCounterChange(event, target) {
    const parent = target.parentNode;
    const itemID = target.dataset.id;
    const fieldStrings = parent.dataset.name;
    const fields = fieldStrings.split(".");

    const min = this.actor[fields[0]][fields[1]][fields[2]].min; //gets the minimum value for this field
    const index = Number(target.dataset.index);

    const steps = parent.querySelectorAll(".resource-value-step");
    const currentValue = parent.querySelectorAll(
      ".resource-value-step.active"
    ).length;
    const newValue = index + 1;

    if (
      index < 0 ||
      index > steps.length ||
      (currentValue === min && newValue === min) //prevents from going below the minimum value
    ) {
      return;
    }

    steps.forEach((step) => {
      step.classList.remove("active");
    });

    steps.forEach((step, i) => {
      if (i <= index) {
        step.classList.add("active");
      }
    });

    if (itemID) {
      const item = this.actor.items.get(itemID);
      let newVal = index + 1;
      if (index === 0 && item.system.points === 1) {
        newVal = 0;
      }
      if (item) {
        this.actor.updateEmbeddedDocuments("Item", [
          {
            _id: itemID,
            system: {
              points: newVal,
            },
          },
        ]);
      }
    } else {
      this._assignToActorField(fields, index + 1);
    }
  }

  _setupDotCounters(element) {
    const actorData = foundry.utils.duplicate(this.actor);
    // Handle .resource-value
    element.querySelectorAll(".resource-value").forEach((resourceEl) => {
      const value = Number(resourceEl.dataset.value);
      const steps = resourceEl.querySelectorAll(".resource-value-step");
      steps.forEach((stepEl, i) => {
        if (i + 1 <= value) {
          stepEl.classList.add("active");
        }
      });
    });

    // Handle .resource-value-static
    element.querySelectorAll(".resource-value-static").forEach((resourceEl) => {
      const value = Number(resourceEl.dataset.value);
      const steps = resourceEl.querySelectorAll(".resource-value-static-step");
      steps.forEach((stepEl, i) => {
        if (i + 1 <= value) {
          stepEl.classList.add("active");
          stepEl.style.backgroundColor = this._getExaltColour(actorData.type);
        }
      });
    });
  }

  _setupSquareCounters(element) {
    element.querySelectorAll(".resource-counter").forEach((counterEl) => {
      const data = counterEl.dataset;
      const states = parseCounterStates(data.states);

      const halfs = Number(data[states["/"]]) || 0;
      const crossed = Number(data[states["x"]]) || 0;
      const stars = Number(data[states["*"]]) || 0;

      const values = new Array(stars + crossed + halfs);
      values.fill("*", 0, stars);
      values.fill("x", stars, stars + crossed);
      values.fill("/", stars + crossed, stars + crossed + halfs);

      const steps = counterEl.querySelectorAll(".resource-counter-step");
      steps.forEach((step) => {
        const index = Number(step.dataset.index);
        step.dataset.state = index < values.length ? values[index] : "";
      });
    });
  }

  _getExaltColour(type) {
    switch (type) {
      case "solar":
        return "#9f9275";
    }
  }
}
