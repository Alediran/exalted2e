/**
 * ExaltedItem – extends the base Foundry Item document.
 */
export class ExaltedItem extends Item {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  // ── Charm Helpers ──────────────────────────────────────────────────────

  /**
   * Activate this charm on the owning actor, spending motes as required.
   * @returns {Promise<boolean>} true if activation succeeded.
   */
  async activateCharm() {
    if (this.type !== "charm") return false;
    const actor = this.actor;
    if (!actor) return false;

    const cost     = this.system.cost;
    const motePool = "peripheral";  // default pool; chosen at activation time

    // Spend motes (spendMotes checks both pools and warns if insufficient)
    if (cost.motes > 0) {
      const spent = await actor.spendMotes(cost.motes, motePool);
      if (!spent) return false;
    }

    // Spend willpower
    if (cost.willpower > 0) {
      const wp = actor.system.willpower;
      await actor.update({ "system.willpower.value": Math.max(0, wp.value - cost.willpower) });
    }

    // Toggle active state for sustained Charms
    if (["oneScene", "indefinite"].includes(this.system.duration)) {
      await this.update({ "system.active": !this.system.active });
    }

    // Send to chat
    await this.sendToChat();
    return true;
  }

  /**
   * Send this item's description as a chat message.
   */
  async sendToChat() {
    const templateData = {
      item:  this,
      actor: this.actor
    };
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/item-card.hbs",
      templateData
    );
    const speaker = this.actor
      ? ChatMessage.getSpeaker({ actor: this.actor })
      : ChatMessage.getSpeaker();

    return ChatMessage.create({ content, speaker });
  }
}
