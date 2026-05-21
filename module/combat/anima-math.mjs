import { EX2E } from "../config.mjs";

export async function stepDownAnima(actor) {
  const sp = actor.system.scenePeripheral ?? 0;
  const T  = EX2E.ANIMA_THRESHOLDS;
  let newSp;
  if      (sp >= T.totemic) newSp = T.bonfire;
  else if (sp >= T.bonfire) newSp = T.burning;
  else if (sp >= T.burning) newSp = T.glowing;
  else if (sp >= T.glowing) newSp = T.dim;
  else if (sp >= T.dim)     newSp = 0;
  else                      return;
  await actor.update({ "system.scenePeripheral": newSp });
}
