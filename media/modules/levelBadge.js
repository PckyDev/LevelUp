export function getLevelBadgeClass(levelValue) {
  const level = Number(levelValue);

  if (level >= 12) {
    return 'portrait-tier-mythic';
  }

  if (level >= 8) {
    return 'portrait-tier-gold';
  }

  if (level >= 5) {
    return 'portrait-tier-azure';
  }

  if (level >= 3) {
    return 'portrait-tier-silver';
  }

  return 'portrait-tier-bronze';
}