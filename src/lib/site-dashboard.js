const childProcess = require("child_process");
const { buildChecklist } = require("../../apps/checklist/server/engine");
const { catalog } = require("../../apps/checklist/server/workshop");

const categoryLabels = {
  assets: "Assets",
  size: "Taille & poids",
  capture: "Capture & disponibilité",
  stats: "Statistiques & PC",
  forms: "Formes & évolutions",
  moves: "Attaques",
  pvp: "PvP",
  shadow: "Shadow",
};

function summarizeChecklist(entries) {
  const generationMap = new Map();
  const categoryMap = new Map();
  const kindMap = new Map();

  for (const entry of entries) {
    const generation = entry.generation || 0;
    const generationStats = generationMap.get(generation) || { generation, count: 0, complete: 0, issues: 0 };
    generationStats.count += 1;
    if (entry.complete) generationStats.complete += 1;
    generationStats.issues += entry.issues.length;
    generationMap.set(generation, generationStats);

    const kindStats = kindMap.get(entry.kind) || { id: entry.kind, count: 0, complete: 0, issues: 0 };
    kindStats.count += 1;
    if (entry.complete) kindStats.complete += 1;
    kindStats.issues += entry.issues.length;
    kindMap.set(entry.kind, kindStats);

    for (const category of entry.issueCategories || [])
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  }

  const decorate = (item) => ({
    ...item,
    percent: Math.round((item.complete / Math.max(item.count, 1)) * 100),
  });

  return {
    total: entries.length,
    complete: entries.filter((entry) => entry.complete).length,
    issues: entries.reduce((sum, entry) => sum + entry.issues.length, 0),
    generations: [...generationMap.entries()]
      .map(([, item]) => decorate(item))
      .sort((left, right) => left.generation - right.generation),
    kinds: [...kindMap.values()]
      .map(decorate)
      .sort((left, right) => right.count - left.count),
    categories: [...categoryMap.entries()]
      .map(([id, count]) => ({ id, label: categoryLabels[id] || id, count }))
      .sort((left, right) => right.count - left.count),
  };
}

function repoFreshness() {
  try {
    const output = childProcess
      .execFileSync("git", ["log", "-1", "--date=short", "--pretty=format:%h|%ad|%s"], {
        cwd: process.cwd(),
        encoding: "utf8",
      })
      .trim();
    const [hash, date, ...subject] = output.split("|");
    return { hash, date, subject: subject.join("|") };
  } catch {
    return null;
  }
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
    freshness: repoFreshness(),
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
