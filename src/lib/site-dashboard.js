const { buildChecklist } = require("../../apps/checklist/server/engine");
const { catalog } = require("../../apps/checklist/server/workshop");

function summarizeChecklist(entries) {
  const generationMap = new Map();
  const categoryMap = new Map();

  for (const entry of entries) {
    const generation = entry.generation || 0;
    generationMap.set(generation, (generationMap.get(generation) || 0) + 1);
    for (const category of entry.issueCategories || [])
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  }

  return {
    total: entries.length,
    complete: entries.filter((entry) => entry.complete).length,
    issues: entries.reduce((sum, entry) => sum + entry.issues.length, 0),
    generations: [...generationMap.entries()]
      .map(([generation, count]) => ({ generation, count }))
      .sort((left, right) => left.generation - right.generation),
    categories: [...categoryMap.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((left, right) => right.count - left.count),
  };
}

function loadSiteDashboard() {
  const entries = buildChecklist();
  const dataCatalog = catalog();
  const featured = [...entries]
    .sort((left, right) => right.quality.score - left.quality.score)
    .slice(0, 3);
  const needsAttention = [...entries]
    .filter((entry) => entry.issues.length > 0)
    .sort((left, right) => right.issues.length - left.issues.length)
    .slice(0, 6);

  return {
    summary: summarizeChecklist(entries),
    featured,
    needsAttention,
    catalog: {
      types: dataCatalog.types.length,
      weather: dataCatalog.weather.length,
      stickers: dataCatalog.stickers.length,
      moves: dataCatalog.moves.length,
      stickerPreview: dataCatalog.stickers.slice(0, 12),
      weatherPreview: dataCatalog.weather.slice(0, 7),
      typePreview: dataCatalog.types.slice(0, 6),
    },
  };
}

module.exports = {
  loadSiteDashboard,
  summarizeChecklist,
};
