const {
  BestAttacker,
  BestDefender,
  CostumeAudit,
  Egg,
  GblCalendar,
  MaxBattle,
  PvpRanking,
  PokemonIdentityMapping,
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

async function identityGeneratorOptions() {
  return {
    identityCatalog: await require("../services/pokemon-identity-service").aliasCatalog(),
  };
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

function compactShinyHistoryData(data) {
  return {
    meta: {
      schemaVersion: data?.meta?.schemaVersion || 1,
      dataset: "shiny-history",
    },
    rankings: Object.fromEntries(
      Object.entries(data?.rankings || {}).map(([board, entries]) => [
        board,
        values(entries).map((entry) => ({
          rank: entry.rank ?? null,
          sourceIdentity: {
            id: entry.sourceIdentity?.id || null,
            variantKey: entry.sourceIdentity?.variantKey || null,
          },
          pokemon: {
            id: entry.pokemon?.id || null,
            formId: entry.pokemon?.formId || null,
          },
          stats: { daily: entry.stats?.daily ?? null },
          shiny: {
            odds: entry.shiny?.odds || null,
            ratePercent: entry.shiny?.ratePercent ?? null,
          },
        })),
      ]),
    ),
  };
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
    data: { meta: data.meta, summary: data.summary, board, podium: filtered.slice(0, 3), rankings: paged.items },
    meta: { ...paged.meta, board, filters: { search: query.search || null, type: type || null, generation, trend, oddsMin, oddsMax } },
  };
}

function presentPvp(data, query = {}) {
  const available = (data.formats || []).map((format) => format.id);
  const league = available.includes(query.league) ? query.league : (available.includes("great") ? "great" : available[0]);
  const search = normalizeIdentity(query.search || "");
  const role = [
    "lead", "closer", "switch", "charger", "attacker", "consistency",
    "stat-product", "offense", "defense", "stamina",
  ].includes(query.role) ? query.role : null;
  const source = values(data.leagues?.[league]?.rankings).map((entry) => ({
    ...entry,
    pokemon: entry.pokemon || data.references?.pokemon?.[entry.pokemonRef] || null,
  }));
  const filtered = source.filter((entry) => {
    const pokemon = entry.pokemon || {};
    const haystack = normalizeIdentity([entry.sourceIdentity?.speciesId, entry.sourceIdentity?.speciesName, pokemon.names?.French, pokemon.names?.English, pokemon.id, pokemon.formId].filter(Boolean).join(" "));
    const value = ["stat-product", "offense", "defense", "stamina"].includes(role)
      ? Number(entry.stats?.[({ "stat-product": "product", offense: "attack", defense: "defense", stamina: "stamina" })[role]])
      : Number(entry.roleScores?.[role]);
    return (!search || haystack.includes(search)) && (!role || value > 0);
  });
  const metricValue = (entry) => {
    if (role === "stat-product") return Number(entry.stats?.product || 0);
    if (role === "offense") return Number(entry.stats?.attack || 0);
    if (role === "defense") return Number(entry.stats?.defense || 0);
    if (role === "stamina") return Number(entry.stats?.stamina || 0);
    return Number(entry.roleScores?.[role] || 0);
  };
  const sorted = role ? [...filtered].sort((left, right) => metricValue(right) - metricValue(left)) : filtered;
  const paged = query.full === "true"
    ? { items: sorted, meta: { page: 1, limit: sorted.length, total: sorted.length, pages: sorted.length ? 1 : 0 } }
    : pageValues(sorted, query);
  return {
    data: {
      meta: data.meta,
      formats: data.formats,
      roles: data.roles || [],
      references: data.references || { moves: {}, types: {} },
      league,
      rankings: paged.items.map((entry) => ({ ...entry, displayScore: role ? metricValue(entry) : entry.score })),
    },
    meta: { ...paged.meta, league, filters: { search: query.search || null, role } },
  };
}

function gblCalendarSummary(data) {
  const periods = values(data?.periods);
  const statuses = periods.reduce((counts, period) => {
    counts[period.status] = (counts[period.status] || 0) + 1;
    return counts;
  }, {});
  return {
    season: data?.season || null,
    total: periods.length,
    competitions: periods.reduce((sum, period) => sum + values(period.competitions).length, 0),
    statuses,
    currentPeriodId: periods.find((period) => period.status === "current")?.id || null,
  };
}

function assertGblCalendarDataset(data) {
  if (!data?.season?.start || !data?.season?.end || !Array.isArray(data?.periods) || !data.periods.length) {
    throw new ApiError(422, "Le calendrier GBL Battleflow est incomplet.", "CURRENT_DATASET_INVALID");
  }
  for (const period of data.periods) {
    if (!period.id || !period.start || !period.end || !["past", "current", "upcoming"].includes(period.status)
      || !Array.isArray(period.competitions) || !period.competitions.length) {
      throw new ApiError(422, `La période GBL ${period.id || "inconnue"} est invalide.`, "CURRENT_DATASET_INVALID");
    }
  }
}

function presentGblCalendar(data, query = {}) {
  const status = ["past", "current", "upcoming"].includes(query.status) ? query.status : null;
  const tier = ["little", "great", "ultra", "master", "custom"].includes(query.tier) ? query.tier : null;
  const cup = normalizeIdentity(query.cup || "");
  const asOf = Date.now();
  const periods = values(data.periods).map((period) => ({
    ...period,
    status: asOf < Date.parse(period.start) ? "upcoming" : asOf < Date.parse(period.end) ? "current" : "past",
  })).filter((period) => {
    const competitions = values(period.competitions);
    return (!status || period.status === status)
      && (!tier || competitions.some((competition) => competition.tier === tier))
      && (!cup || competitions.some((competition) => normalizeIdentity(competition.cup).includes(cup)));
  });
  return {
    data: { meta: data.meta, season: data.season, periods },
    meta: { total: periods.length, asOf: new Date(asOf).toISOString(), filters: { status, tier, cup: cup || null } },
  };
}

const BEST_ATTACKER_LEVELS = [30, 40, 50];
const BEST_ATTACKER_METRICS = ["edps", "dps", "tdo"];

function queryBoolean(value) {
  if (value === undefined || value === null || value === "") return null;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function attackerTier(percentage) {
  if (percentage >= 90) return "S";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  return "C";
}

function assertBestAttackersDataset(data) {
  const levels = values(data?.metadata?.levels);
  const types = values(data?.metadata?.types);
  if (!data?.rankings || !data?.entities || !data?.moves || !levels.length || !types.length) {
    throw new ApiError(422, "Le dataset Best Attackers est incomplet.", "CURRENT_DATASET_INVALID");
  }
  for (const level of levels) {
    for (const type of types) {
      if (!Array.isArray(data.rankings?.[`level${level}`]?.[type])) {
        throw new ApiError(422, `Le classement niveau ${level}/${type} est absent.`, "CURRENT_DATASET_INVALID");
      }
    }
  }
}

function bestAttackersSummary(data) {
  return {
    pokemon: Object.keys(data?.entities || {}).length,
    moves: Object.keys(data?.moves || {}).length,
    rankings: Number(data?.metadata?.localData?.rankingCount || 0),
    levels: values(data?.metadata?.levels),
    types: values(data?.metadata?.types),
    metrics: values(data?.metadata?.algorithm?.metrics),
  };
}

function presentBestAttackers(data, query = {}) {
  const levels = values(data.metadata?.levels);
  const types = values(data.metadata?.types);
  const requestedLevel = Number.parseInt(query.level, 10);
  const level = levels.includes(requestedLevel) ? requestedLevel : (levels.includes(40) ? 40 : levels[0]);
  const requestedType = String(query.type || "ANY").toUpperCase();
  const type = types.includes(requestedType) ? requestedType : "ANY";
  const metric = BEST_ATTACKER_METRICS.includes(String(query.metric).toLowerCase())
    ? String(query.metric).toLowerCase()
    : "edps";
  const search = normalizeIdentity(query.search || "");
  const shadow = queryBoolean(query.shadow);
  const mega = queryBoolean(query.mega);
  const elite = queryBoolean(query.elite);
  const pokemonClass = String(query.class || "").toUpperCase();
  const movesetClass = ["on-type", "same-type", "mixed", "off-type"].includes(query.movesetClass)
    ? query.movesetClass
    : null;
  const source = values(data.rankings?.[`level${level}`]?.[type]);
  const ordered = [...source].sort((left, right) => Number(right[metric]) - Number(left[metric])
    || Number(right.tdo) - Number(left.tdo)
    || String(left.pokemonKey).localeCompare(String(right.pokemonKey)));
  const maximum = Number(ordered[0]?.[metric] || 0);
  const globalRank = new Map(ordered.map((entry, index) => [entry.pokemonKey, index + 1]));
  const filtered = ordered.filter((entry) => {
    const pokemon = data.entities[entry.pokemonKey] || {};
    const haystack = normalizeIdentity([
      pokemon.pokemonId, pokemon.formId, pokemon.names?.French, pokemon.names?.English, pokemon.dexNr,
      data.moves?.[entry.fastMoveId]?.names?.French, data.moves?.[entry.fastMoveId]?.names?.English,
      data.moves?.[entry.chargedMoveId]?.names?.French, data.moves?.[entry.chargedMoveId]?.names?.English,
    ].filter(Boolean).join(" "));
    return (!search || haystack.includes(search))
      && (shadow === null || Boolean(pokemon.shadow) === shadow)
      && (mega === null || Boolean(pokemon.mega) === mega)
      && (elite === null || Boolean(entry.eliteFast || entry.eliteCharged) === elite)
      && (!pokemonClass || String(pokemon.class || "").toUpperCase() === pokemonClass)
      && (!movesetClass || entry.movesetClass === movesetClass);
  });
  const paged = query.full === "true"
    ? { items: filtered, meta: { page: 1, limit: filtered.length, total: filtered.length, pages: filtered.length ? 1 : 0 } }
    : pageValues(filtered, query);
  return {
    data: {
      metadata: data.metadata,
      options: { levels, types, metrics: BEST_ATTACKER_METRICS },
      rankings: paged.items.map((entry) => {
        const percentage = maximum > 0 ? Number(((Number(entry[metric]) / maximum) * 100).toFixed(2)) : 0;
        return {
          ...entry,
          rank: globalRank.get(entry.pokemonKey),
          rating: percentage,
          percentage,
          tier: attackerTier(percentage),
          selectedMetric: metric,
          pokemon: data.entities[entry.pokemonKey] || null,
          fastMove: data.moves[entry.fastMoveId] || null,
          chargedMove: data.moves[entry.chargedMoveId] || null,
        };
      }),
    },
    meta: {
      ...paged.meta,
      level,
      type,
      metric,
      filters: {
        search: query.search || null,
        shadow,
        mega,
        elite,
        class: pokemonClass || null,
        movesetClass,
      },
    },
  };
}

function bestDefendersSummary(data) {
  const tiers = Object.fromEntries(values(data?.tiers).map((tier) => [tier.id, values(tier.entries).length]));
  return { total: Object.values(tiers).reduce((sum, count) => sum + count, 0), tiers };
}

function assertBestDefendersDataset(data) {
  const expected = ["S", "A+", "A", "B", "C", "D"];
  if (!Array.isArray(data?.tiers) || data.tiers.length !== expected.length) {
    throw new ApiError(422, "Le dataset Best Defenders est incomplet.", "CURRENT_DATASET_INVALID");
  }
  for (const tier of data.tiers) {
    if (!expected.includes(tier.id) || !Array.isArray(tier.entries) || !tier.entries.length) {
      throw new ApiError(422, `Le tier Best Defenders ${tier.id || "inconnu"} est invalide.`, "CURRENT_DATASET_INVALID");
    }
  }
}

function presentBestDefenders(data, query = {}) {
  const tier = ["S", "A+", "A", "B", "C", "D"].includes(String(query.tier || "").toUpperCase())
    ? String(query.tier).toUpperCase()
    : null;
  const search = normalizeIdentity(query.search || "");
  const type = String(query.type || "").toUpperCase();
  const source = values(data.tiers).filter((entry) => !tier || entry.id === tier).flatMap((entry) => values(entry.entries));
  const filtered = source.filter((entry) => {
    const pokemon = entry.pokemon || {};
    const haystack = normalizeIdentity([entry.source?.name, pokemon.names?.French, pokemon.names?.English, pokemon.dexNr, pokemon.formId].filter(Boolean).join(" "));
    return (!search || haystack.includes(search))
      && (!type || values(pokemon.types).map((value) => String(value).toUpperCase()).includes(type));
  });
  const paged = pageValues(filtered, { ...query, limit: query.limit || 100 });
  return {
    data: { metadata: data.metadata, tiers: data.tiers.map(({ id, label, description, entries }) => ({ id, label, description, total: entries.length })), rankings: paged.items },
    meta: { ...paged.meta, filters: { tier, search: query.search || null, type: type || null } },
  };
}

function costumeAuditSummary(data) {
  return { total: values(data?.items).length, ...(data?.metadata?.statusCounts || {}) };
}

function assertCostumeAuditDataset(data) {
  if (data?.metadata?.visibility !== "private" || !Array.isArray(data?.items) || !data.items.length) {
    throw new ApiError(422, "Le dataset privé Costume Audit est invalide.", "CURRENT_DATASET_INVALID");
  }
}

const FRENCH_MONTHS = Object.freeze({
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
});

function costumeEventDate(entry = {}) {
  const label = normalizeIdentity([...(entry.events || []), entry.source?.title].filter(Boolean).join(" "));
  const monthNames = Object.keys(FRENCH_MONTHS).join("|");
  const crossMonth = label.match(new RegExp(`(\\d{1,2})(?:er)?-(${monthNames})-au-\\d{1,2}(?:er)?-(${monthNames})-(\\d{4})`));
  if (crossMonth) return new Date(Date.UTC(Number(crossMonth[4]), FRENCH_MONTHS[crossMonth[2]], Number(crossMonth[1]))).toISOString();
  const sameMonth = label.match(new RegExp(`(?:(\\d{1,2})(?:er)?-au-)?(\\d{1,2})(?:er)?-(${monthNames})-(\\d{4})`));
  if (sameMonth) return new Date(Date.UTC(Number(sameMonth[4]), FRENCH_MONTHS[sameMonth[3]], Number(sameMonth[1] || sameMonth[2]))).toISOString();
  const year = label.match(/(?:^|-)((?:19|20)\d{2})(?:-|$)/)?.[1];
  return year ? new Date(Date.UTC(Number(year), 0, 1)).toISOString() : null;
}

function hydratedCostumeEntry(entry, result) {
  if (result?.status !== "matched" || !result.identity) {
    const status = result?.status === "ambiguous" ? "ambiguous" : "unresolved";
    return {
      ...entry,
      eventDate: costumeEventDate(entry),
      types: values(entry.identity?.types),
      identity: {
        ...entry.identity,
        resolutionStatus: status,
        resolution: {
          ...entry.identity?.resolution,
          status,
          strategy: result?.strategy || entry.identity?.resolution?.strategy || "unresolved",
          reason: result?.reason || entry.identity?.resolution?.reason || "ALIAS_UNKNOWN",
          reasonDetails: result?.reasonDetails || entry.identity?.resolution?.reasonDetails || null,
          candidates: result?.candidates || entry.identity?.resolution?.candidates || [],
        },
      },
      pokemonGoData: { ...entry.pokemonGoData, status },
    };
  }
  const identity = result.identity;
  const selectedAsset = result.selectedAsset || null;
  const normalAsset = selectedAsset?.image || identity.localIdentity?.assets?.image || null;
  const shinyAsset = selectedAsset?.shinyImage || identity.localIdentity?.assets?.shinyImage || null;
  const status = normalAsset ? "present" : "asset-missing";
  return {
    ...entry,
    eventDate: costumeEventDate(entry),
    types: values(identity.localIdentity?.types),
    identity: {
      ...entry.identity,
      pokemonId: identity.pokemonId,
      pokemon: identity.localIdentity?.pokemonKey || entry.identity?.pokemon || null,
      canonicalId: identity.canonicalId,
      identityId: identity.identityId,
      form: identity.form,
      costume: identity.costume,
      gender: selectedAsset?.gender || null,
      image: normalAsset,
      shinyImage: shinyAsset,
      localFile: identity.localIdentity?.sourceFile || identity.localReference?.file || null,
      localAssetsRef: identity.localIdentity?.assetsRef || identity.localReference?.assetsRef || null,
      resolutionStatus: "matched",
      resolution: {
        status: "matched",
        strategy: result.strategy,
        confidence: result.confidence,
        source: "identity-manager-live",
        reason: normalAsset ? null : "ASSET_ENTRY_NOT_FOUND",
        reasonDetails: normalAsset ? null : "L’identité est résolue mais son asset canonique exact est absent.",
        warnings: normalAsset ? [] : ["ASSET_ENTRY_NOT_FOUND"],
        candidates: [],
      },
    },
    pokemonGoData: {
      ...entry.pokemonGoData,
      status,
      canonicalId: identity.canonicalId,
      localFile: identity.localIdentity?.sourceFile || identity.localReference?.file || null,
      exactNormalAsset: normalAsset,
      exactShinyAsset: shinyAsset,
      genderVariants: values(identity.localIdentity?.genderAssets),
    },
  };
}

function costumeStatusCounts(items) {
  const counts = { present: 0, unresolved: 0, ambiguous: 0, "asset-missing": 0, inconsistent: 0, duplicate: 0, shinyAvailable: 0, shinyAssetMissing: 0, missing: 0 };
  for (const entry of items) {
    const status = entry.pokemonGoData?.status || "unresolved";
    if (Object.hasOwn(counts, status)) counts[status] += 1;
    if (status !== "present") counts.missing += 1;
    if (entry.shinyAvailable) counts.shinyAvailable += 1;
    if (entry.shinyAvailable && !entry.pokemonGoData?.exactShinyAsset) counts.shinyAssetMissing += 1;
  }
  return counts;
}

function costumeSortValue(entry, sort) {
  if (sort === "event") return entry.events?.[0] || "";
  if (sort === "type") return entry.types?.[0] || "";
  if (sort === "name") return `${entry.source?.pokemonName || ""} ${entry.source?.costumeName || ""}`;
  if (sort === "pokemonId") return Number(entry.identity?.pokemonId) || Number.MAX_SAFE_INTEGER;
  if (sort === "date") return entry.eventDate ? Date.parse(entry.eventDate) : null;
  return Number(entry.sourceIndex) || Number.MAX_SAFE_INTEGER;
}

function sortCostumeEntries(items, sort, order) {
  const direction = order === "desc" ? -1 : 1;
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
  return [...items].sort((left, right) => {
    const leftValue = costumeSortValue(left, sort);
    const rightValue = costumeSortValue(right, sort);
    if (leftValue === null || leftValue === "") return rightValue === null || rightValue === "" ? 0 : 1;
    if (rightValue === null || rightValue === "") return -1;
    const compared = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : collator.compare(String(leftValue), String(rightValue));
    return compared * direction;
  });
}

async function presentCostumeAudit(data, query = {}, dependencies = {}) {
  const resolveAliasesBatch = dependencies.resolveAliasesBatch
    || require("../services/pokemon-identity-service").resolveAliasesBatch;
  const source = values(data.items);
  const resolutions = await resolveAliasesBatch(source.map((entry) => ({
    provider: "margxt",
    rawAlias: entry.identity?.form || entry.identity?.costume || entry.identity?.raw?.rawCostume || entry.source?.costumeName || entry.source?.title,
    pokemonId: entry.identity?.pokemonId || null,
    form: entry.identity?.form || null,
    costume: entry.identity?.costume || null,
    isFemale: typeof entry.identity?.isFemale === "boolean" ? entry.identity.isFemale : undefined,
  })));
  const hydrated = source.map((entry, index) => hydratedCostumeEntry(entry, resolutions[index]));
  const search = normalizeIdentity(query.search || "");
  const allowedStatuses = ["present", "missing", "unresolved", "ambiguous", "asset-missing", "inconsistent", "duplicate"];
  const status = allowedStatuses.includes(query.status) ? query.status : null;
  const shiny = queryBoolean(query.shiny);
  const event = normalizeIdentity(query.event || "");
  const type = String(query.type || "").toUpperCase();
  const sort = ["date", "event", "type", "name", "pokemonId"].includes(query.sort) ? query.sort : "date";
  const order = query.order === "asc" ? "asc" : "desc";
  const filtered = hydrated.filter((entry) => {
    const haystack = normalizeIdentity([entry.source?.title, entry.source?.pokemonName, entry.source?.costumeName, entry.identity?.pokemonId, ...(entry.types || []), ...(entry.events || [])].filter(Boolean).join(" "));
    return (!search || haystack.includes(search))
      && (!status || (status === "missing" ? entry.pokemonGoData?.status !== "present" : entry.pokemonGoData?.status === status))
      && (shiny === null || Boolean(entry.shinyAvailable) === shiny)
      && (!event || values(entry.events).some((value) => normalizeIdentity(value) === event))
      && (!type || values(entry.types).map((value) => String(value).toUpperCase()).includes(type));
  });
  const sorted = sortCostumeEntries(filtered, sort, order);
  const paged = pageValues(sorted, query);
  const availableEvents = [...new Set(hydrated.flatMap((entry) => values(entry.events)))].sort((left, right) => left.localeCompare(right, "fr"));
  const availableTypes = [...new Set(hydrated.flatMap((entry) => values(entry.types).map((value) => String(value).toUpperCase())))].sort();
  return {
    data: {
      metadata: { ...data.metadata, statusCounts: costumeStatusCounts(hydrated), availableEvents, availableTypes },
      items: paged.items,
    },
    meta: { ...paged.meta, filters: { search: query.search || null, status, shiny, event: query.event || null, type: type || null, sort, order } },
  };
}

function assertPokemonIdentityMappings(data) {
  if (!Array.isArray(data?.mappings) || !data.mappings.length || !data?.metadata?.source) {
    throw new ApiError(422, "Le mapping Game Master Pokémon est vide ou invalide.", "CURRENT_DATASET_INVALID");
  }
}

function identityMappingsSummary(data) {
  return {
    total: Number(data?.metadata?.total || data?.mappings?.length || 0),
    statusCounts: data?.metadata?.statusCounts || {},
    sourceUpdatedAt: data?.metadata?.sourceUpdatedAt || null,
  };
}

function presentPokemonIdentityMappings(data, query = {}) {
  const status = String(query.status || "");
  const search = normalizeIdentity(query.search || "");
  const filtered = values(data.mappings).filter((mapping) => {
    const haystack = normalizeIdentity([
      mapping.pokemonId, mapping.pokemon, mapping.form, mapping.templateId,
      mapping.assetBundleValue, mapping.assetBundleSuffix, mapping.localForm,
    ].filter(Boolean).join(" "));
    return (!status || mapping.mappingStatus === status) && (!search || haystack.includes(search));
  });
  const paged = query.full === "true"
    ? { items: filtered, meta: { page: 1, limit: filtered.length, total: filtered.length, pages: filtered.length ? 1 : 0 } }
    : pageValues(filtered, query);
  return {
    data: { metadata: data.metadata, mappings: paged.items },
    meta: { ...paged.meta, filters: { status: status || null, search: query.search || null } },
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
  "pokemon-identity-mappings": {
    domain: "pokemon-identity-mappings",
    visibility: "private",
    rootKey: "mappings",
    metaKey: "summary",
    provider: "PokeMiners-game_masters",
    sourceUrl: "https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json",
    strictSourceUrl: true,
    Model: PokemonIdentityMapping,
    compactCurrent: true,
    scriptName: "generateGameMasterPokemonMappings.js",
    exportName: "generateGameMasterPokemonMappings",
    generatorOptions: identityGeneratorOptions,
    jsonPath: "game-master/gameMasterPokemonMappings.json",
    summarize: identityMappingsSummary,
    stats: (data) => ({
      itemsParsed: Number(data?.metadata?.total || 0),
      itemsMatched: Number(data?.metadata?.statusCounts?.matched || 0),
      itemsUnmatched: Number(data?.metadata?.total || 0) - Number(data?.metadata?.statusCounts?.matched || 0),
    }),
    validate: assertPokemonIdentityMappings,
    count: (_data, summary) => summary.total,
    extractEntries: (data) => values(data.mappings).map((mapping) => ({
      key: `${mapping.templateId}:${mapping.form}:${mapping.assetBundleValue || ""}:${mapping.assetBundleSuffix || ""}`,
      value: mapping,
    })),
    present: presentPokemonIdentityMappings,
  },
  "best-attackers": {
    domain: "best-attackers",
    visibility: "public",
    rootKey: "rankings",
    metaKey: "summary",
    provider: "dialgadex-official-repository",
    sourceUrl: "https://github.com/mgrann03/dialgadex",
    strictSourceUrl: true,
    Model: BestAttacker,
    compactCurrent: true,
    compressData: true,
    scriptName: "generateBestAttackers.js",
    exportName: "generateBestAttackers",
    jsonPath: "best-attackers/bestAttackers.json",
    summarize: bestAttackersSummary,
    stats: (data) => ({
      itemsParsed: Number(data?.metadata?.localData?.rankingCount || 0),
      itemsMatched: Number(data?.metadata?.localData?.rankingCount || 0),
      itemsUnmatched: 0,
    }),
    validate: assertBestAttackersDataset,
    count: (_data, summary) => summary.rankings,
    extractEntries: (data) => Object.entries(data.rankings || {}).flatMap(([level, byType]) =>
      Object.entries(byType || {}).flatMap(([type, entries]) => values(entries).map((entry) => ({
        key: `${level}:${type}:${entry.pokemonKey}`,
        value: entry,
      }))),
    ),
    present: presentBestAttackers,
  },
  "best-defenders": {
    domain: "best-defenders",
    visibility: "public",
    rootKey: "tiers",
    metaKey: "summary",
    provider: "pokemon-go-hub",
    sourceUrl: "https://db.pokemongohub.net/fr/best/gym-defenders",
    strictSourceUrl: true,
    Model: BestDefender,
    compactCurrent: true,
    compressData: true,
    scriptName: "generateBestDefenders.js",
    exportName: "generateBestDefenders",
    generatorOptions: identityGeneratorOptions,
    jsonPath: "best-defenders/current.json",
    summarize: bestDefendersSummary,
    stats: (_data, report) => ({ itemsParsed: Number(report.parsedCount || report.rawCount || 0), itemsMatched: Number(report.matchedCount || 0), itemsUnmatched: Number(report.unmatchedCount || 0) }),
    validate: assertBestDefendersDataset,
    count: (_data, summary) => summary.total,
    extractEntries: (data) => values(data.tiers).flatMap((tier) => values(tier.entries).map((entry) => ({ key: `${tier.id}:${entry.rank}:${entry.source?.slug || entry.pokemon?.dexNr}`, value: entry }))),
    present: presentBestDefenders,
  },
  "costume-audit": {
    domain: "costume-audit",
    visibility: "private",
    rootKey: "items",
    metaKey: "summary",
    provider: "margxt",
    sourceUrl: "https://www.margxt.fr/guide-les-pokemon-deguises-dans-pokemon-go/",
    strictSourceUrl: true,
    Model: CostumeAudit,
    compactCurrent: true,
    compressData: true,
    scriptName: "generateCostumeAudit.js",
    exportName: "generateCostumeAudit",
    generatorOptions: identityGeneratorOptions,
    jsonPath: "costume-audit/current.json",
    summarize: costumeAuditSummary,
    stats: (_data, report) => ({ itemsParsed: Number(report.parsedCount || report.rawCount || 0), itemsMatched: Number(report.matchedCount || 0), itemsUnmatched: Number(report.unmatchedCount || 0) }),
    validate: assertCostumeAuditDataset,
    count: (_data, summary) => summary.total,
    extractEntries: (data) => values(data.items).map((entry) => ({ key: entry.id, value: entry })),
    present: presentCostumeAudit,
  },
  shiny: {
    domain: "shiny",
    visibility: "private",
    rootKey: "rankings",
    metaKey: "summary",
    provider: "snacknap",
    sourceUrl: "https://www.snacknap.com/pokemon/shiny",
    strictSourceUrl: true,
    Model: ShinyRanking,
    SnapshotModel: ShinySnapshot,
    compactCurrent: true,
    compressData: true,
    scriptName: "generateShinyTracker.js",
    exportName: "generateShinyTracker",
    generatorOptions: identityGeneratorOptions,
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
    snapshotData: compactShinyHistoryData,
    historyPoints: shinyHistoryPoint,
    historySummary: summarizeShinyHistory,
  },
  "pvp-rankings": {
    domain: "pvp-rankings",
    visibility: "public",
    rootKey: "leagues",
    metaKey: "formats",
    provider: "pvpoke-official-repository",
    sourceUrl: "https://github.com/pvpoke/pvpoke",
    strictSourceUrl: true,
    Model: PvpRanking,
    compactCurrent: true,
    compressData: true,
    asyncRegeneration: true,
    scriptName: "generatePvpRankings.js",
    exportName: "generatePvpRankings",
    generatorOptions: identityGeneratorOptions,
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
  "gbl-calendar": {
    domain: "gbl-calendar",
    visibility: "public",
    rootKey: "periods",
    metaKey: "summary",
    provider: "battleflow",
    sourceUrl: "https://battleflow.app/fr/gbl-calendar/",
    strictSourceUrl: true,
    Model: GblCalendar,
    compactCurrent: true,
    scriptName: "generateGblCalendar.js",
    exportName: "generateGblCalendar",
    jsonPath: "gbl-calendar/current.json",
    summarize: gblCalendarSummary,
    stats: (_data, report) => ({
      itemsParsed: Number(report.parsedCount || report.rawCount || 0),
      itemsMatched: Number(report.matchedCount || 0),
      itemsUnmatched: Number(report.unmatchedCount || 0),
    }),
    validate: assertGblCalendarDataset,
    count: (_data, summary) => summary.total,
    extractEntries: (data) => values(data.periods).map((period) => ({ key: period.id, value: period })),
    present: presentGblCalendar,
  },
  raids: {
    domain: "raids",
    visibility: "public",
    rootKey: "currentList",
    metaKey: "buckets",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/raid-bosses/",
    strictSourceUrl: true,
    Model: Raid,
    scriptName: "generateCurrentRaids.js",
    exportName: "generateCurrentRaids",
    generatorOptions: identityGeneratorOptions,
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
    visibility: "public",
    rootKey: "currentEggsList",
    metaKey: "buckets",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/eggs/",
    Model: Egg,
    scriptName: "generateCurrentEggs.js",
    exportName: "generateCurrentEggs",
    generatorOptions: identityGeneratorOptions,
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
    visibility: "public",
    rootKey: "currentMaxBattle",
    metaKey: "buckets",
    provider: "snacknap",
    sourceUrl: "https://www.snacknap.com/max-battles",
    Model: MaxBattle,
    scriptName: "generateCurrentMaxBattles.js",
    exportName: "generateCurrentMaxBattles",
    generatorOptions: identityGeneratorOptions,
    jsonPath: "max-battles/currentsMaxBattle.json",
    summarize: maxBattleSummary,
    stats: (_data, report, summary) => bucketStats(report, summary),
    validate: (data) => assertPokemonEntries(data, "currentMaxBattle", "max-battles"),
    count: (_data, summary) => countSummary(summary),
    extractEntries: (data) => bucketEntries(data, "currentMaxBattle", pokemonIdentity),
  },
  research: {
    domain: "research",
    visibility: "public",
    rootKey: "currentResearchList",
    metaKey: "summary",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/research/",
    Model: Research,
    scriptName: "generateCurrentResearch.js",
    exportName: "generateCurrentResearch",
    generatorOptions: identityGeneratorOptions,
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
    visibility: "public",
    rootKey: "currentRocketList",
    metaKey: "summary",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/rocket-lineups/",
    Model: Rocket,
    scriptName: "generateCurrentRocket.js",
    exportName: "generateCurrentRocket",
    generatorOptions: identityGeneratorOptions,
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
  assertBestAttackersDataset,
  assertGblCalendarDataset,
  assertPokemonIdentityMappings,
  bestAttackersSummary,
  compactShinyHistoryData,
  getCurrentDatasetAdapter,
  normalizeIdentity,
  pokemonIdentity,
  presentBestAttackers,
  presentGblCalendar,
  presentPokemonIdentityMappings,
  summarizeShinyHistory,
};
