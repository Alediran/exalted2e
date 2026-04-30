export const CLARITY_BANDS = [
  { min: 0,  max: 2,  socialPenalty: 0, compassionPenalty: 0, compassionAutoFail: false, mentalBonus: 0, autochthonBonus: 0 },
  { min: 3,  max: 4,  socialPenalty: 1, compassionPenalty: 1, compassionAutoFail: false, mentalBonus: 0, autochthonBonus: 1 },
  { min: 5,  max: 7,  socialPenalty: 2, compassionPenalty: 2, compassionAutoFail: false, mentalBonus: 0, autochthonBonus: 2 },
  { min: 8,  max: 9,  socialPenalty: 3, compassionPenalty: 3, compassionAutoFail: false, mentalBonus: 1, autochthonBonus: 3 },
  { min: 10, max: 10, socialPenalty: 4, compassionPenalty: 4, compassionAutoFail: true,  mentalBonus: 3, autochthonBonus: 4 },
];

export function getClarityBand(total) {
  return CLARITY_BANDS.find(b => total >= b.min && total <= b.max) ?? CLARITY_BANDS[0];
}

export function computeTotalClarity(permanent, temporary) {
  return Math.min(10, permanent + temporary);
}

export function computePermanentClarity(essenceValue, installedExemplarCount) {
  return Math.max(0, essenceValue - 5) + installedExemplarCount;
}
