const { env } = require("../config/env");

const entries = new Map();
const currentDatasetPathPattern = /^\/api\/v1\/(?:admin\/)?(?:raids|eggs|max-battles|research|rocket)\/?$/;
const currentDatasetPrefixes = Object.freeze({
  raids: ["/api/v1/raids", "/api/v1/admin/raids"],
  eggs: ["/api/v1/eggs", "/api/v1/admin/eggs"],
  "max-battles": ["/api/v1/max-battles", "/api/v1/admin/max-battles"],
  research: ["/api/v1/research", "/api/v1/admin/research"],
  rocket: ["/api/v1/rocket", "/api/v1/admin/rocket"],
});

function pruneCache() {
  const now = Date.now();
  const maxEntries = Math.max(1, env.cacheMaxEntries);
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
  while (entries.size >= maxEntries) {
    entries.delete(entries.keys().next().value);
  }
}

function cacheMiddleware(options = {}) {
  const ttl = (options.ttlSeconds || env.cacheTtlSeconds) * 1000;
  return (request, response, next) => {
    if (request.method !== "GET" || request.query.fresh === "true") return next();
    const requestPath = String(request.originalUrl || request.path || "").split("?")[0];
    if (currentDatasetPathPattern.test(requestPath)) {
      response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      response.setHeader("X-Cache", "BYPASS");
      return next();
    }
    const key = request.originalUrl;
    const cached = entries.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      response.setHeader("X-Cache", "HIT");
      return response.status(cached.status).json(cached.body);
    }
    if (cached) entries.delete(key);

    const originalJson = response.json.bind(response);
    response.json = (body) => {
      const cacheControl = String(response.getHeader("Cache-Control") || "");
      if (
        response.statusCode >= 200 &&
        response.statusCode < 300 &&
        !/(?:^|,)\s*no-store\b/i.test(cacheControl)
      ) {
        pruneCache();
        entries.set(key, {
          status: response.statusCode,
          body,
          expiresAt: Date.now() + ttl,
        });
      }
      response.setHeader("X-Cache", "MISS");
      return originalJson(body);
    };
    return next();
  };
}

function clearCache() {
  entries.clear();
}

function clearCacheByPrefix(prefix) {
  let deleted = 0;
  for (const key of entries.keys()) {
    if (!key.startsWith(prefix)) continue;
    entries.delete(key);
    deleted += 1;
  }
  return deleted;
}

function invalidateDatasetCache(domain) {
  return (currentDatasetPrefixes[domain] || []).reduce(
    (deleted, prefix) => deleted + clearCacheByPrefix(prefix),
    0,
  );
}

module.exports = {
  cacheMiddleware,
  clearCache,
  clearCacheByPrefix,
  invalidateDatasetCache,
};
