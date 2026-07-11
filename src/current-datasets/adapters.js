const { Egg, MaxBattle, Raid, Research, Rocket } = require("../models");
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
};
