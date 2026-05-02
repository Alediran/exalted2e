import { EX2E } from "../config.mjs";

export function sceneChangeFade(sp) {
  const T = EX2E.ANIMA_THRESHOLDS;
  if      (sp >= T.bonfire) return T.bonfire - 1;
  else if (sp >= T.burning) return T.burning - 1;
  else if (sp >= T.glowing) return T.glowing - 1;
  else                      return sp;
}
