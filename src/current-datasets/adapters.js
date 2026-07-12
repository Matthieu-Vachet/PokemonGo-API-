const {
  Egg,
  MaxBattle,
  PvpRanking,
  Raid,
  Research,
  Rocket,
  ShinyRanking,
  ShinySnapshot,
} = require("../models");
const { ApiError } = require("../lib/api-error");
const { bucketStats } = require("../lib/current-data-pipeline");

function values(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pokemonIdentity(entry = {}) {
  return [
    entry.id || entry.pokemonId || entry.sourceName || entry.names?.English,
    entry.form || entry.formId,
    entry.costume,
  ]
    .map(normalizeIdentity)
    .filter(Boolean)
    .join(":") || "unknown";
}

function rotationIdentity(entry = {}) {
  const rotation = entry.rotation || {};
  return [rotation.name, rotation.startsAt, rotation.endsAt, rotation.timeLabel]
    .map(normalizeIdentity)
    .filter(Boolean)
    .join(":") || "default";
}

function bucketSummary(data, key) {
  return Object.fromEntries(
    Object.entries(data?.[key] || {}).map(([bucket, entries]) => [bucket, values(entries).length]),
  );
}

function countSummary(summary) {
  return Object.values(summary || {}).reduce((sum, count) => sum + Number(count || 0), 0);
}

function pageValues(valuesToPage, query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  const total = valuesToPage.length;
  const start = (page - 1) * limit;
  return {
    items: valuesToPage.slice(start, start + limit),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

function generationForDex(value) {
  const dex = Number(value) || 0;
  if (dex <= 151) return 1;
  if (dex <= 251) return 2;
  if (dex <= 386) return 3;
  if (dex <= 493) return 4;
  if (dex <= 649) return 5;
  if (dex <= 721) return 6;
  if (dex <= 809) return 7;
  if (dex <= 905) return 8;
  return 9;
}

function rankedIdentity(entry = {}) {
  return entry.pokemon?.formId
    || entry.sourceIdentity?.variantKey
    || entry.sourceIdentity?.speciesId
    || entry.sourceIdentity?.id
    || pokemonIdentity(entry.pokemon || entry);
}

function shinySummary(data) {
  return data?.summary || Object.fromEntries(
    Object.entries(data?.rankings || {}).map(([board, entries]) => [board, values(entries).length]),
  );
}

function pvpSummary(data) {
  return Object.fromEntries((data?.formats || []).map((format) => [format.id, Number(format.total || data?.leagues?.[format.id]?.rankings?.length || 0)]));
}

function assertShinyDataset(data) {
  if (!data?.rankings || typeof data.rankings !== "object") throw new ApiError(422, "rankings est requis pour shiny.", "CURRENT_DATASET_INVALID");
  for (const board of ["today", "total", "rare"]) {
    if (!Array.isArray(data.rankings[board]) || !data.rankings[board].length) throw new ApiError(422, `Le classement shiny ${board} est vide.`, "CURRENT_DATASET_EMPTY");
  }
}

function assertPvpDataset(data) {
  if (!Array.isArray(data?.formats) || !data.formats.length || !data?.leagues) throw new ApiError(422, "Les formats PvP sont requis.", "CURRENT_DATASET_INVALID");
  for (const format of data.formats) {
    if (!Array.isArray(data.leagues?.[format.id]?.rankings) || !data.leagues[format.id].rankings.length) throw new ApiError(422, `Le classement PvP ${format.id} est vide.`, "CURRENT_DATASET_EMPTY");
  }
}

function presentShiny(data, query = {}) {
  const board = ["today", "total", "rare"].includes(query.board) ? query.board : "today";
  const search = normalizeIdentity(query.search || "");
  const type = String(query.type || "").toUpperCase();
  const generation = Number.parseInt(query.generation, 10) || null;
  const trend = ["up", "down", "flat"].includes(query.trend) ? query.trend : null;
  const oddsMin = Number(query.oddsMin) || null;
  const oddsMax = Number(query.oddsMax) || null;
  const filtered = values(data.rankings[board]).filter((entry) => {
    const pokemon = entry.pokemon || {};
    const denominator = Number(entry.shiny?.odds?.denominator) || 0;
    const haystack = normalizeIdentity([entry.sourceIdentity?.name, pokemon.names?.French, pokemon.names?.English, pokemon.id, pokemon.formId, pokemon.dexNr].filter(Boolean).join(" "));
    return (!search || haystack.includes(search))
      && (!type || values(pokemon.types).map((value) => String(value).toUpperCase()).includes(type))
      && (!generation || generationForDex(pokemon.dexNr) === generation)
      && (!trend || entry.source?.trend === trend)
      && (!oddsMin || denominator >= oddsMin)
      && (!oddsMax || denominator <= oddsMax);
  });
  const paged = pageValues(filtered, query);
  return {
    data: { meta: data.meta, summary: data.summary, board, rankings: paged.items },
    meta: { ...paged.meta, board, filters: { search: query.search || null, type: type || null, generation, trend, oddsMin, oddsMax } },
  };
}

function presentPvp(data, query = {}) {
  const available = (data.formats || []).map((format) => format.id);
  const league = available.includes(query.league) ? query.league : (available.includes("great") ? "great" : available[0]);
  const search = normalizeIdentity(query.search || "");
  const role = ["lead", "closer", "switch", "charger", "attacker", "consistency"].includes(query.role) ? query.role : null;
  const source = values(data.leagues?.[league]?.rankings);
  const filtered = source.filter((entry) => {
    const pokemon = entry.pokemon || {};
    const haystack = normalizeIdentity([entry.sourceIdentity?.speciesId, entry.sourceIdentity?.speciesName, pokemon.names?.French, pokemon.names?.English, pokemon.id, pokemon.formId].filter(Boolean).join(" "));
    return (!search || haystack.includes(search)) && (!role || Number(entry.roleScores?.[role]) > 0);
  });
  const sorted = role ? [...filtered].sort((left, right) => Number(right.roleScores?.[role] || 0) - Number(left.roleScores?.[role] || 0)) : filtered;
  const paged = pageValues(sorted, query);
  return {
    data: { meta: data.meta, formats: data.formats, league, rankings: paged.items },
    meta: { ...paged.meta, league, filters: { search: query.search || null, role } },
  };
}

function shinyHistoryPoint(snapshot, identity, query = {}) {
  const board = ["today", "total", "rare"].includes(query.board) ? query.board : "total";
  const wanted = normalizeIdentity(identity);
  const entry = values(snapshot.data?.rankings?.[board]).find((item) => [
    item.pokemon?.id,
    item.pokemon?.formId,
    item.sourceIdentity?.id,
    item.sourceIdentity?.variantKey,
  ].some((value) => normalizeIdentity(value) === wanted));
  if (!entry) return null;
  return {
    snapshotAt: snapshot.snapshotAt,
    sourceHash: snapshot.sourceHash,
    board,
    rank: entry.rank,
    odds: entry.shiny?.odds || null,
    sample: entry.stats?.daily ?? null,
    ratePercent: entry.shiny?.ratePercent ?? null,
  };
}

function summarizeOdds(points) {
  const observations = values(points)
    .map((point) => ({
      snapshotAt: point.snapshotAt,
      value: Number(point.odds?.denominator),
    }))
    .filter((point) => Number.isFinite(point.value) && point.value > 0);
  if (!observations.length) return null;

  const first = observations[0];
  const current = observations[observations.length - 1];
  const best = observations.reduce((selected, point) => point.value < selected.value ? point : selected);
  const worst = observations.reduce((selected, point) => point.value > selected.value ? point : selected);
  const absolute = current.value - first.value;

  return {
    observations: observations.length,
    current,
    average: Number((observations.reduce((sum, point) => sum + point.value, 0) / observations.length).toFixed(2)),
    variation: {
      absolute,
      percent: first.value ? Number(((absolute / first.value) * 100).toFixed(2)) : null,
    },
    best,
    worst,
  };
}

function summarizeShinyHistory(points) {
  const ordered = [...values(points)].sort((left, right) => new Date(left.snapshotAt) - new Date(right.snapshotAt));
  const latestAt = ordered.at(-1)?.snapshotAt ? new Date(ordered.at(-1).snapshotAt).getTime() : null;
  const window = (days) => {
    if (!latestAt) return null;
    return summarizeOdds(ordered.filter((point) => new Date(point.snapshotAt).getTime() >= latestAt - days * 24 * 60 * 60 * 1000));
  };
  const daily = new Map();
  for (const point of ordered) {
    const value = Number(point.odds?.denominator);
    if (Number.isFinite(value) && value > 0) daily.set(new Date(point.snapshotAt).toISOString().slice(0, 10), value);
  }
  let previous = null;
  const dailyEvolution = [...daily.entries()].map(([date, value]) => {
    const change = previous == null ? null : value - previous;
    const result = {
      date,
      value,
      change,
      changePercent: previous ? Number(((change / previous) * 100).toFixed(2)) : null,
    };
    previous = value;
    return result;
  });

  return {
    metric: "odds_denominator",
    lowerIsBetter: true,
    allTime: summarizeOdds(ordered),
    windows: { sevenDays: window(7), thirtyDays: window(30) },
    dailyEvolution,
  };
}

function assertBucketDataset(data, key, domain) {
  const buckets = data?.[key];
  if (!buckets || Array.isArray(buckets) || typeof buckets !== "object") {
    throw new ApiError(422, `${key} est requis pour ${domain}.`, "CURRENT_DATASET_INVALID");
  }
  for (const [bucket, entries] of Object.entries(buckets)) {
    if (!Array.isArray(entries)) {
      throw new ApiError(422, `La categorie ${bucket} de ${domain} doit etre un tableau.`, "CURRENT_DATASET_INVALID");
    }
  }
  if (!countSummary(bucketSummary(data, key))) {
    throw new ApiError(422, `Le dataset ${domain} est vide.`, "CURRENT_DATASET_EMPTY");
  }
}

function assertPokemonEntries(data, key, domain) {
  assertBucketDataset(data, key, domain);
  for (const entries of Object.values(data[key])) {
    for (const entry of entries) {
      const name = entry?.sourceName || entry?.names?.English || entry?.id;
      if (!name) throw new ApiError(422, `Une entree ${domain} n'a aucun nom source.`, "CURRENT_DATASET_INVALID");
      if (!Array.isArray(entry.types)) {
        throw new ApiError(422, `Les types de ${name} doivent etre un tableau.`, "CURRENT_DATASET_INVALID");
      }
    }
  }
}

function bucketEntries(data, key, identity) {
  return Object.entries(data?.[key] || {}).flatMap(([bucket, entries]) =>
    values(entries).map((entry) => ({
      key: `${normalizeIdentity(bucket)}:${identity(entry, bucket)}`,
      value: entry,
    })),
  );
}

function raidSummary(data) {
  return bucketSummary(data, "currentList");
}

function eggSummary(data) {
  return bucketSummary(data, "currentEggsList");
}

function maxBattleSummary(data) {
  return bucketSummary(data, "currentMaxBattle");
}

function researchSummary(data) {
  const buckets = bucketSummary(data, "currentResearchList");
  const tasks = Object.values(data?.currentResearchList || {}).flatMap(values);
  const rewards = tasks.flatMap((task) => values(task.rewards));
  return {
    buckets,
    tasks: tasks.length,
    pokemonRewards: rewards.filter((reward) => reward.rewardType === "pokemon").length,
    itemRewards: rewards.filter((reward) => reward.rewardType === "item").length,
  };
}

function rocketSummary(data) {
  const current = data?.currentRocketList || {};
  const leaders = Object.values(current.leaders || {}).flatMap(values);
  const giovanni = values(current.giovanni);
  const grunts = values(current.grunts);
  const others = values(current.others);
  const profiles = [...giovanni, ...leaders, ...grunts, ...others];
  const pokemonEntries = profiles.reduce(
    (sum, profile) =>
      sum + Object.values(profile?.slots || {}).reduce((slotSum, slot) => slotSum + values(slot).length, 0),
    0,
  );
  return {
    giovanni: giovanni.length,
    leaders: leaders.length,
    grunts: grunts.length,
    others: others.length,
    trainers: profiles.length,
    pokemonEntries,
  };
}

function researchIdentity(task, category) {
  const rewards = values(task.rewards).map((item) => {
    const reward = item.reward || item;
    return [item.rewardType || task.rewardType, pokemonIdentity(reward), reward.id || reward.itemId || reward.name]
      .map(normalizeIdentity)
      .filter(Boolean)
      .join(":");
  }).sort();
  return [category, task.task, ...rewards].map(normalizeIdentity).filter(Boolean).join(":");
}

function rocketEntries(data) {
  const current = data?.currentRocketList || {};
  const groups = [
    ["giovanni", values(current.giovanni)],
    ["leader", Object.values(current.leaders || {}).flatMap(values)],
    ["grunt", values(current.grunts)],
    ["other", values(current.others)],
  ];
  return groups.flatMap(([group, profiles]) => profiles.flatMap((profile) => {
    const profileKey = `${group}:${normalizeIdentity(profile.trainerSlug || profile.trainer || profile.quote)}`;
    const { slots = {}, rewards = [], ...profileMetadata } = profile;
    const entries = [{ key: `${profileKey}:profile`, value: profileMetadata }];
    for (const [slot, pokemon] of Object.entries(slots)) {
      for (const entry of values(pokemon)) {
        entries.push({
          key: `${profileKey}:${normalizeIdentity(slot)}:${pokemonIdentity(entry)}`,
          value: entry,
        });
      }
    }
    for (const reward of values(rewards)) {
      entries.push({
        key: `${profileKey}:reward:${pokemonIdentity(reward)}`,
        value: reward,
      });
    }
    return entries;
  }));
}

const adapters = {
  shiny: {
    domain: "shiny",
    rootKey: "rankings",
    metaKey: "summary",
    provider: "snacknap",
    sourceUrl: "https://www.snacknap.com/pokemon/shiny",
    strictSourceUrl: true,
    Model: ShinyRanking,
    SnapshotModel: ShinySnapshot,
    compactCurrent: true,
    scriptName: "generateShinyTracker.js",
    exportName: "generateShinyTracker",
    jsonPath: "shiny-tracker/current.json",
    summarize: shinySummary,
    stats: (_data, report) => ({
      itemsParsed: Number(report.parsedCount || report.rawCount || 0),
      itemsMatched: Number(report.matchedCount || 0),
      itemsUnmatched: Number(report.unmatchedCount || 0),
    }),
    validate: assertShinyDataset,
    count: (_data, summary) => countSummary(summary),
    extractEntries: (data) => Object.entries(data.rankings || {}).flatMap(([board, rankings]) => values(rankings).map((entry) => ({ key: `${board}:${normalizeIdentity(rankedIdentity(entry))}:${entry.rank}`, value: entry }))),
    present: presentShiny,
    historyPoints: shinyHistoryPoint,
    historySummary: summarizeShinyHistory,
  },
  "pvp-rankings": {
    domain: "pvp-rankings",
    rootKey: "leagues",
    metaKey: "formats",
    provider: "pvpoke-official-repository",
    sourceUrl: "https://github.com/pvpoke/pvpoke",
    strictSourceUrl: true,
    Model: PvpRanking,
    compactCurrent: true,
    scriptName: "generatePvpRankings.js",
    exportName: "generatePvpRankings",
    jsonPath: "pvp-rankings/current.json",
    summarize: pvpSummary,
    stats: (_data, report) => ({
      itemsParsed: Number(report.parsedCount || report.rawCount || 0),
      itemsMatched: Number(report.matchedCount || 0),
      itemsUnmatched: Number(report.unmatchedCount || 0),
    }),
    validate: assertPvpDataset,
    count: (_data, summary) => countSummary(summary),
    extractEntries: (data) => Object.entries(data.leagues || {}).flatMap(([league, value]) => values(value.rankings).map((entry) => ({ key: `${league}:${normalizeIdentity(rankedIdentity(entry))}`, value: entry }))),
    present: presentPvp,
  },
  raids: {
    domain: "raids",
    rootKey: "currentList",
    metaKey: "buckets",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/raid-bosses/",
    strictSourceUrl: true,
    Model: Raid,
    scriptName: "generateCurrentRaids.js",
    exportName: "generateCurrentRaids",
    jsonPath: "raids/currentRaids.json",
    summarize: raidSummary,
    stats: (_data, report, summary) => bucketStats(report, summary),
    validate: (data) => assertPokemonEntries(data, "currentList", "raids"),
    count: (_data, summary) => countSummary(summary),
    extractEntries: (data) =>
      bucketEntries(
        data,
        "currentList",
        (entry) => `${normalizeIdentity(entry.sectionTitle)}:${pokemonIdentity(entry)}:${rotationIdentity(entry)}`,
      ),
  },
  eggs: {
    domain: "eggs",
    rootKey: "currentEggsList",
    metaKey: "buckets",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/eggs/",
    Model: Egg,
    scriptName: "generateCurrentEggs.js",
    exportName: "generateCurrentEggs",
    jsonPath: "eggs/currentEggs.json",
    summarize: eggSummary,
    stats: (_data, report, summary) => bucketStats(report, summary),
    validate: (data) => assertPokemonEntries(data, "currentEggsList", "eggs"),
    count: (_data, summary) => countSummary(summary),
    extractEntries: (data) =>
      bucketEntries(data, "currentEggsList", (entry) => `${pokemonIdentity(entry)}:${entry.rarity || "none"}`),
  },
  "max-battles": {
    domain: "max-battles",
    rootKey: "currentMaxBattle",
    metaKey: "buckets",
    provider: "snacknap",
    sourceUrl: "https://www.snacknap.com/max-battles",
    Model: MaxBattle,
    scriptName: "generateCurrentMaxBattles.js",
    exportName: "generateCurrentMaxBattles",
    jsonPath: "max-battles/currentsMaxBattle.json",
    summarize: maxBattleSummary,
    stats: (_data, report, summary) => bucketStats(report, summary),
    validate: (data) => assertPokemonEntries(data, "currentMaxBattle", "max-battles"),
    count: (_data, summary) => countSummary(summary),
    extractEntries: (data) => bucketEntries(data, "currentMaxBattle", pokemonIdentity),
  },
  research: {
    domain: "research",
    rootKey: "currentResearchList",
    metaKey: "summary",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/research/",
    Model: Research,
    scriptName: "generateCurrentResearch.js",
    exportName: "generateCurrentResearch",
    jsonPath: "research/currentResearch.json",
    summarize: researchSummary,
    stats: (_data, report, summary) => ({
      itemsParsed: summary.tasks,
      itemsMatched: Number(
        report.matchedCount
        ?? (Number(report.pokemonRewardsMatched || 0) + Number(report.itemRewardsMatched || 0)),
      ),
      itemsUnmatched: Number(
        report.unmatchedCount
        ?? (values(report.unmatchedPokemonRewards).length + values(report.unmatchedItemRewards).length),
      ),
    }),
    validate(data) {
      assertBucketDataset(data, "currentResearchList", "research");
      for (const tasks of Object.values(data.currentResearchList)) {
        for (const task of tasks) {
          if (!String(task?.task || "").trim() || !Array.isArray(task.rewards)) {
            throw new ApiError(422, "Une tache Research est invalide.", "CURRENT_DATASET_INVALID");
          }
        }
      }
    },
    count: (_data, summary) => summary.tasks,
    extractEntries: (data) =>
      bucketEntries(data, "currentResearchList", (task, category) => researchIdentity(task, category)),
  },
  rocket: {
    domain: "rocket",
    rootKey: "currentRocketList",
    metaKey: "summary",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/rocket-lineups/",
    Model: Rocket,
    scriptName: "generateCurrentRocket.js",
    exportName: "generateCurrentRocket",
    jsonPath: "rocket/currentRocket.json",
    summarize: rocketSummary,
    stats: (_data, report, summary) => ({
      itemsParsed: Number(report.pokemonEntries || summary.pokemonEntries || 0),
      itemsMatched: Number(report.matched ?? summary.pokemonEntries ?? 0),
      itemsUnmatched: Number(
        report.unmatchedCount
        ?? Math.max(Number(report.pokemonEntries || summary.pokemonEntries || 0) - Number(report.matched ?? summary.pokemonEntries ?? 0), 0),
      ),
    }),
    validate(data) {
      const summary = rocketSummary(data);
      if (!data?.currentRocketList || !summary.trainers || !summary.pokemonEntries) {
        throw new ApiError(422, "Le dataset Rocket est vide ou invalide.", "CURRENT_DATASET_INVALID");
      }
    },
    count: (_data, summary) => summary.trainers,
    extractEntries: rocketEntries,
  },
};

function getCurrentDatasetAdapter(domain) {
  const adapter = adapters[domain];
  if (!adapter) throw new ApiError(500, `Adaptateur current inconnu: ${domain}.`, "CURRENT_ADAPTER_NOT_FOUND");
  return adapter;
}

module.exports = {
  getCurrentDatasetAdapter,
  normalizeIdentity,
  pokemonIdentity,
  summarizeShinyHistory,
};
