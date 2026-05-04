export async function sanctifyOathBinding(actor, targets, description) {
  if (actor.system.motes.peripheral.value < 10) {
    ui.notifications.warn(game.i18n.localize("EX2E.OathInsufficientMotes"));
    return null;
  }
  if (actor.system.willpower.value < 1) {
    ui.notifications.warn(game.i18n.localize("EX2E.OathInsufficientWillpower"));
    return null;
  }

  await actor.spendMotes(10, "peripheral");
  await actor.update({ "system.willpower.value": actor.system.willpower.value - 1 });

  const essence  = actor.system.essence.value;
  const oathName = description
    ? `${game.i18n.localize("EX2E.SacredOath")}: ${description}`
    : game.i18n.localize("EX2E.SacredOath");

  for (const target of targets) {
    await target.createEmbeddedDocuments("ActiveEffect", [{
      name: oathName,
      icon: "icons/svg/statue.svg",
      flags: { exalted2e: { oathBotch: { bindingEssence: essence, description: description ?? "" } } }
    }]);
  }

  const targetNames = targets.map(t => t.name).join(", ");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<em>${actor.name}</em> has sanctified an oath with <em>${targetNames}</em>. Breaking it invites Heaven's wrath.`,
    flags: {
      exalted2e: {
        oathBinding: {
          eclipseId:   actor.id,
          targetIds:   targets.map(t => t.id),
          essence,
          description: description ?? ""
        }
      }
    }
  });

  return true;
}
