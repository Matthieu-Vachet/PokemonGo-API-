const mongoose = require("mongoose");
const { ApiError } = require("../lib/api-error");

const DASHBOARD_DB = process.env.DASHBOARD_MONGODB_DB || "matweb-dashboard-admin";
const MAX_LIMIT = 100;

function collection(name) {
  if (!mongoose.connection.client) throw new ApiError(503, "MongoDB indisponible.", "DATABASE_UNAVAILABLE");
  return mongoose.connection.client.db(DASHBOARD_DB).collection(name);
}

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1) throw new ApiError(400, "Paramètre de pagination invalide.", "INVALID_PAGINATION");
  return Math.min(number, maximum);
}

function escapedRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function booleanQuery(value, name) {
  if (value === undefined) return undefined;
  if (value === "true" || value === true || value === "1") return true;
  if (value === "false" || value === false || value === "0") return false;
  throw new ApiError(400, `${name} doit valoir true ou false.`, "INVALID_BOOLEAN_FILTER");
}

function dateRange(yearValue, monthValue) {
  if (yearValue === undefined && monthValue === undefined) return null;
  const year = positiveInteger(yearValue, new Date().getUTCFullYear(), 9999);
  const month = monthValue === undefined ? null : positiveInteger(monthValue, 1, 12);
  const start = month ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, 0, 1));
  const end = month ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));
  return { $gte: start, $lt: end };
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function publicCommunityDay(document) {
  if (!document) return null;
  return {
    id: document.id,
    sourceId: document.sourceId,
    title: document.title,
    eventType: "community-day",
    startDate: iso(document.startDate),
    endDate: iso(document.endDate),
    year: document.year,
    month: document.month,
    status: document.status,
    featuredPokemon: document.featuredPokemon || [],
    exclusiveMoves: document.exclusiveMoves || [],
    bonuses: document.bonuses || [],
    shinyAvailable: document.shinyAvailable,
    sourceUrl: document.sourceUrl,
    firstSeenAt: iso(document.firstSeenAt),
    lastSeenAt: iso(document.lastSeenAt),
    createdAt: iso(document.createdAt),
    updatedAt: iso(document.updatedAt),
    revision: document.revision || 1,
  };
}

function publicArchivedEvent(document) {
  if (!document) return null;
  return {
    id: document.id,
    sourceId: document.sourceId,
    canonicalKey: document.canonicalKey,
    title: document.title,
    slug: document.slug,
    eventType: document.eventType,
    startDate: iso(document.startDate),
    endDate: iso(document.endDate),
    status: document.status,
    description: document.description || "",
    bonuses: document.bonuses || [],
    pokemon: document.pokemon || [],
    raids: document.raids || [],
    research: document.research || [],
    images: document.images || [],
    provider: document.provider,
    sourceUrl: document.sourceUrl,
    firstSeenAt: iso(document.firstSeenAt),
    lastSeenAt: iso(document.lastSeenAt),
    createdAt: iso(document.createdAt),
    updatedAt: iso(document.updatedAt),
    revision: document.revision || 1,
    activeInCurrentFeed: document.activeInCurrentFeed === true,
    archived: document.archived === true,
  };
}

async function paginatedList(collectionName, query, filter, projection) {
  const page = positiveInteger(query.page, 1);
  const limit = positiveInteger(query.limit, 50, MAX_LIMIT);
  const target = collection(collectionName);
  const [documents, total, latest] = await Promise.all([
    target.find(filter).sort({ startDate: -1, id: 1 }).skip((page - 1) * limit).limit(limit).toArray(),
    target.countDocuments(filter),
    target.findOne({}, { sort: { updatedAt: -1 }, projection: { updatedAt: 1 } }),
  ]);
  return {
    documents: documents.map(projection),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      updatedAt: iso(latest?.updatedAt) || null,
    },
  };
}

async function listCommunityDays(query = {}) {
  const filter = {};
  const range = dateRange(query.year, query.month);
  if (range) filter.startDate = range;
  if (query.status) {
    if (!["past", "active", "upcoming"].includes(query.status)) throw new ApiError(400, "Statut Community Day invalide.", "INVALID_STATUS");
    filter.status = query.status;
  }
  if (query.pokemon) filter["featuredPokemon.pokemonId"] = new RegExp(`^${escapedRegex(query.pokemon)}$`, "i");
  const result = await paginatedList("community_days", query, filter, publicCommunityDay);
  result.meta.source = "pogoapi-community-days";
  return result;
}

async function getCommunityDay(id) {
  const document = await collection("community_days").findOne({ $or: [{ id }, { sourceId: id }] });
  if (!document) throw new ApiError(404, "Community Day introuvable.", "COMMUNITY_DAY_NOT_FOUND");
  return publicCommunityDay(document);
}

async function listEventHistory(query = {}) {
  const filter = {};
  const range = dateRange(query.year, query.month);
  if (range) filter.startDate = range;
  if (query.type) filter.eventType = String(query.type);
  if (query.status) {
    if (!["past", "active", "upcoming"].includes(query.status)) throw new ApiError(400, "Statut d'événement invalide.", "INVALID_STATUS");
    filter.status = query.status;
  }
  if (query.provider) filter.provider = String(query.provider);
  if (query.pokemon) filter["pokemon.name"] = new RegExp(escapedRegex(query.pokemon), "i");
  const active = booleanQuery(query.activeInCurrentFeed, "activeInCurrentFeed");
  if (active !== undefined) filter.activeInCurrentFeed = active;
  const modified = booleanQuery(query.modified, "modified");
  if (modified !== undefined) filter.revision = modified ? { $gt: 1 } : 1;
  const result = await paginatedList("events_archive", query, filter, publicArchivedEvent);
  result.meta.source = "events-archive";
  return result;
}

async function getEventHistory(id, { includeRevisions = false } = {}) {
  const document = await collection("events_archive").findOne({
    $or: [{ id }, { sourceId: id }, { canonicalKey: id }],
  });
  if (!document) throw new ApiError(404, "Événement archivé introuvable.", "EVENT_HISTORY_NOT_FOUND");
  const result = publicArchivedEvent(document);
  if (includeRevisions) result.revisionHistory = document.revisionHistory || [];
  return result;
}

module.exports = {
  MAX_LIMIT,
  booleanQuery,
  dateRange,
  getCommunityDay,
  getEventHistory,
  listCommunityDays,
  listEventHistory,
  publicArchivedEvent,
  publicCommunityDay,
};
