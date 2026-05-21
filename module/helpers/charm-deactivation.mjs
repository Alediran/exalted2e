const ACTION_COUNT_DURATIONS = new Set([
  "untilNextAction", "oneAction", "twoActions", "threeActions",
]);

// Calendar-range durations (oneDay…untilCalibration, formula) are intentionally
// excluded — they outlast scenes and require manual or ST-managed teardown.
const SCENE_SWEEP_DURATIONS = new Set([
  "oneScene", "untilNextAction", "oneAction", "twoActions", "threeActions",
]);

const REMAINING_ACTIONS_MAP = {
  untilNextAction: 1,
  oneAction:       1,
  twoActions:      2,
  threeActions:    3,
};

export function initialRemainingActions(duration) {
  return REMAINING_ACTIONS_MAP[duration] ?? null;
}

export async function clearSceneCharms(actor) {
  if (!actor) return;
  const toDelete = actor.effects
    .filter(e => SCENE_SWEEP_DURATIONS.has(e.flags?.exalted2e?.charmDuration))
    .map(e => e.id);
  if (toDelete.length) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
  }
}

export async function decrementActionCharmsFor(actor) {
  if (!actor) return;
  const aes = actor.effects.filter(
    e => ACTION_COUNT_DURATIONS.has(e.flags?.exalted2e?.charmDuration)
  );
  const toDelete = [];
  const toUpdate = [];
  for (const ae of aes) {
    const remaining = (ae.flags?.exalted2e?.remainingActions ?? 1) - 1;
    if (remaining <= 0) toDelete.push(ae.id);
    else toUpdate.push({ _id: ae.id, "flags.exalted2e.remainingActions": remaining });
  }
  if (toUpdate.length) await actor.updateEmbeddedDocuments("ActiveEffect", toUpdate);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
}
