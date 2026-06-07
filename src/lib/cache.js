const { env } = require("../config/env");

const entries = new Map();

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
    const key = request.originalUrl;
    const cached = entries.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      response.setHeader("X-Cache", "HIT");
      return response.status(cached.status).json(cached.body);
    }
    if (cached) entries.delete(key);

    const originalJson = response.json.bind(response);
    response.json = (body) => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
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

module.exports = { cacheMiddleware, clearCache };
