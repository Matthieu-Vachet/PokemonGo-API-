const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true });

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function booleanFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: numberFromEnv("PORT", 3000),
  mongoUri: process.env.MONGODB_URI || "",
  apiBasePath: process.env.API_BASE_PATH || "/api/v1",
  publicUrl:
    process.env.API_PUBLIC_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  corsOrigins: (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  rateLimitWindowMs: numberFromEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  rateLimitMax: numberFromEnv("RATE_LIMIT_MAX", 300),
  cacheTtlSeconds: numberFromEnv("CACHE_TTL_SECONDS", 60),
  cacheMaxEntries: numberFromEnv("CACHE_MAX_ENTRIES", 5000),
  trustProxy: numberFromEnv("TRUST_PROXY", 1),
  syncDeleteStale: booleanFromEnv("SYNC_DELETE_STALE", true),
  isProduction: process.env.NODE_ENV === "production",
};

module.exports = { env };
