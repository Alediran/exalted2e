export function computeVentUpdate(currentLimit, currentBanked, successes) {
  if (successes > 0) {
    return {
      limit:           Math.max(0, currentLimit - successes),
      bankedResonance: currentBanked + successes,
    };
  }
  return {
    limit:           Math.min(10, currentLimit + 1),
    bankedResonance: currentBanked,
  };
}
