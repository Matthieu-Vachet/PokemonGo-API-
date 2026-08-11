const { ApiError } = require("./api-error");
const { dataRoot } = require("./data-repository");
const { getGeneratorRegistration } = require("./generator-registry");

function errorCode(source, suffix) {
  return `${String(source).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${suffix}`;
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function countBuckets(buckets = {}) {
  return Object.values(buckets).reduce((sum, count) => sum + Number(count || 0), 0);
}

function buildPipelineReport({ source, report = {}, summary = {}, stats = {}, jsonPath, mongoUpdated = false, updatedAt }) {
  return {
    success: true,
    source,
    sourceUrl: report.source || null,
    itemsParsed: Number(stats.itemsParsed || 0),
    itemsMatched: Number(stats.itemsMatched || 0),
    itemsUnmatched: Number(stats.itemsUnmatched || 0),
    jsonPath,
    mongoUpdated: Boolean(mongoUpdated),
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString(),
    summary,
    report,
  };
}

async function generateCurrentData(options) {
  const registration = getGeneratorRegistration(options.generatorKey || options.source);
  const generator = registration.generator;
  const generatorOptionsStartedAt = Date.now();
  const generatorOptions = typeof options.generatorOptions === "function"
    ? await options.generatorOptions()
    : (options.generatorOptions || {});
  console.info(`[current-data:${options.source}] Generator options loaded`, {
    identityCatalogSize: Array.isArray(generatorOptions.identityCatalog) ? generatorOptions.identityCatalog.length : 0,
    elapsedMs: Date.now() - generatorOptionsStartedAt,
  });
  const result = await generator({ ...generatorOptions, rootDir: dataRoot });
  const data = result?.data;
  const report = result?.report || {};
  if (!data || typeof data !== "object") {
    throw new ApiError(502, "No data parsed from source", errorCode(options.source, "REGENERATE_EMPTY"));
  }

  const summary = options.summarize(data);
  const stats = options.stats(data, report, summary);
  if (Number(stats.itemsParsed || 0) <= 0) {
    console.warn(`[current-data:${options.source}] No data parsed from source`, {
      sourceUrl: report.source || null,
      jsonPath: options.jsonPath,
      summary,
    });
    throw new ApiError(502, "No data parsed from source", errorCode(options.source, "REGENERATE_EMPTY"));
  }

  if (typeof options.validate === "function") {
    options.validate(data, report, summary);
  }

  console.info(`[current-data:${options.source}] Generation report`, {
    sourceUrl: report.source || null,
    itemsParsed: Number(stats.itemsParsed || 0),
    itemsMatched: Number(stats.itemsMatched || 0),
    itemsUnmatched: Number(stats.itemsUnmatched || 0),
    jsonPath: options.jsonPath,
  });

  return {
    data,
    report,
    summary,
    stats,
    pipeline: buildPipelineReport({
      source: options.source,
      report,
      summary,
      stats,
      jsonPath: options.jsonPath,
    }),
  };
}

function bucketStats(report = {}, buckets = {}) {
  const itemsParsed = Number(
    report.totalParsed ?? report.parsedCount ?? report.fetched ?? countBuckets(buckets),
  );
  const itemsUnmatched = Number(
    report.totalUnmatched ?? report.unmatchedCount ?? countArray(report.unmatched),
  );
  return {
    itemsParsed,
    itemsMatched: Number(
      report.totalMatched
      ?? report.matchedCount
      ?? report.matched
      ?? Math.max(itemsParsed - itemsUnmatched, 0),
    ),
    itemsUnmatched,
  };
}

module.exports = {
  buildPipelineReport,
  bucketStats,
  countBuckets,
  generateCurrentData,
};
