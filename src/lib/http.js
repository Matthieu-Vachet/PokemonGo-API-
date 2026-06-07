const { ApiError } = require("./api-error");

function integer(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function boolean(value) {
  if (value === undefined) return undefined;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  throw new ApiError(400, `Valeur booléenne invalide : ${value}`, "INVALID_FILTER");
}

function csv(value) {
  if (value === undefined || value === "") return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function pagination(query) {
  const page = integer(query.page, 1, { min: 1 });
  const limit = integer(query.limit, 25, { min: 1, max: 100 });
  return { page, limit, skip: (page - 1) * limit };
}

function sortFromQuery(value, allowed, fallback) {
  if (!value) return fallback;
  const sort = {};
  for (const item of csv(value)) {
    const descending = item.startsWith("-");
    const field = descending ? item.slice(1) : item;
    if (!allowed.includes(field)) {
      throw new ApiError(400, `Tri non autorisé : ${field}`, "INVALID_SORT");
    }
    sort[field] = descending ? -1 : 1;
  }
  return Object.keys(sort).length ? sort : fallback;
}

function paginatedResponse(items, total, page, limit, extra = {}) {
  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      ...extra,
    },
  };
}

module.exports = {
  boolean,
  csv,
  integer,
  pagination,
  paginatedResponse,
  sortFromQuery,
};
