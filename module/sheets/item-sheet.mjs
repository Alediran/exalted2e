import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from "../helpers/effects.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheetV2}
 */
export class ExaltedSecondItemSheet extends HandlebarsApplicationMixin(
  ItemSheetV2
) {
  constructor(...args) {
    super(...args);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  static DEFAULT_OPTIONS = {
    window: {
      title: "Item Sheet",
      resizable: true,
      controls: [
        {
          icon: "fa-solid fa-gear-code",
          label: "Ex3.Macros",
          action: "openMacroDialog",
        },
      ],
    },
    position: { width: 520, height: 480 },
    classes: ["exalted2e", "sheet", "item"],
    actions: {
      onEditImage: this._onEditImage,
      //openMacroDialog: this.openMacroDialog,
      //editTraits: this.editTraits,
      effectControl: this.effectControl,
      // toggleField: this.toggleField,
      triggerAction: this.triggerAction,
      //triggerSubItemAction: this.triggerSubItemAction,
      //upgradeAction: this.upgradeAction,
      //alternateAction: this.alternateAction,
      //showDialog: this.showDialog,
      //showEmbeddedItem: this.showEmbeddedItem,
      //deleteEmbeddedItem: this.deleteEmbeddedItem,
    },
    dragDrop: [{ dragSelector: "[data-drag]", dropSelector: null }],
    form: {
      submitOnChange: true,
    },
  };

  static PARTS = {
    background: {
      template: "systems/exalted2e/templates/item/item-background-sheet.hbs",
    },
    charm: {
      template: "systems/exalted2e/templates/item/item-charm-sheet.hbs",
    },
    spell: {
      template: "systems/exalted2e/templates/item/item-spell-sheet.hbs",
    },
  };

  _initializeApplicationOptions(options) {
    options.classes = [
      //options.document.getSheetBackground(),
      "exalted2e",
      "sheet",
      "item",
    ];
    return super._initializeApplicationOptions(options);
  }

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
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
      attributeList: CONFIG.EXALTED2E.attributes,
    };
  }

  /** @override */
  _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element));
    this._setupButtons(this.element);
  }

  async _preparePartContext(partId, context) {
    // context.tab = context.tabs.find((item) => item.partId === partId);
    return context;
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

  static effectControl(event, target) {
    onManageActiveEffect(target, this.item);
  }

  static triggerAction(event, target) {
    const actionType = target.dataset.actiontype;
    const triggerType = target.dataset.type;

    if (actionType === "add") {
      if (triggerType) {
        const newList = this.item.system.triggers[triggerType];
        let listIndex = 0;
        let indexAdd = "0";
        for (const key of Object.keys(newList)) {
          if (key !== listIndex.toString()) {
            break;
          }
          listIndex++;
        }
        indexAdd = listIndex.toString();
        newList[indexAdd] = {
          name: "",
          triggerTime: "beforeRoll",
          actorType: "",
          requirementMode: "",
          bonuses: {},
          requirements: {},
        };
        this.item.update({ [`system.triggers.${triggerType}`]: newList });
      }
    }
    if (actionType === "delete") {
      let index = target.dataset.index;
      this.item.update({
        [`system.triggers.${triggerType}.-=${index}`]: null,
      });
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
   */
  get dragDrop() {
    return this.#dragDrop;
  }

  // This is marked as private because there's no real need
  // for subclasses or external hooks to mess with it directly
  #dragDrop;

  /**
   * Create drag-and-drop workflow handlers for this Application
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

  _setupButtons(element) {}
}
