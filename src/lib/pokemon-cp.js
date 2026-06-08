const LEVEL_CPM = {
  1: 0.094,
  2: 0.16639787,
  3: 0.21573247,
  4: 0.25572005,
  5: 0.29024988,
  6: 0.3210876,
  7: 0.34921268,
  8: 0.3752356,
  9: 0.39956728,
  10: 0.4225,
  11: 0.44310755,
  12: 0.46279839,
  13: 0.48168495,
  14: 0.49985844,
  15: 0.51739395,
  16: 0.53435433,
  17: 0.55079269,
  18: 0.56675452,
  19: 0.58227891,
  20: 0.5974,
  21: 0.61215729,
  22: 0.62656713,
  23: 0.64065295,
  24: 0.65443563,
  25: 0.667934,
  26: 0.68116492,
  27: 0.69414365,
  28: 0.70688421,
  29: 0.71939909,
  30: 0.7317,
  31: 0.73776948,
  32: 0.74378943,
  33: 0.74976104,
  34: 0.75568551,
  35: 0.76156384,
  36: 0.76739717,
  37: 0.7731865,
  38: 0.77893275,
  39: 0.78463697,
  40: 0.79030001,
  41: 0.79530001,
  42: 0.8003,
  43: 0.8053,
  44: 0.81029999,
  45: 0.81529999,
  46: 0.82029999,
  47: 0.82529999,
  48: 0.83029999,
  49: 0.83529999,
  50: 0.84029999,
};

function cpMultiplier(level) {
  if (LEVEL_CPM[level]) return LEVEL_CPM[level];
  if (level < 1 || level > 50 || level % 0.5 !== 0) return null;

  const lower = Math.floor(level);
  const upper = Math.ceil(level);
  return Math.sqrt(
    (LEVEL_CPM[lower] ** 2 + LEVEL_CPM[upper] ** 2) / 2,
  );
}

function calculateCp(stats, level, ivs = {}) {
  const cpm = cpMultiplier(level);
  if (!stats || cpm === null) return null;

  const attack = Number(stats.attack) + Number(ivs.attack || 0);
  const defense = Number(stats.defense) + Number(ivs.defense || 0);
  const stamina = Number(stats.stamina) + Number(ivs.stamina || 0);
  if (![attack, defense, stamina].every(Number.isFinite)) return null;

  return Math.max(
    10,
    Math.floor(
      (attack * Math.sqrt(defense) * Math.sqrt(stamina) * cpm ** 2) / 10,
    ),
  );
}

function buildCpByLevel(stats) {
  const levels = [];
  for (let level = 1; level <= 50; level += 0.5) {
    levels.push({
      level,
      minCp: calculateCp(stats, level),
      maxCp: calculateCp(stats, level, {
        attack: 15,
        defense: 15,
        stamina: 15,
      }),
    });
  }
  return levels;
}

module.exports = { LEVEL_CPM, cpMultiplier, calculateCp, buildCpByLevel };
