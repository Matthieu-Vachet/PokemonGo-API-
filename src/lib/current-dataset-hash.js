const crypto = require("node:crypto");

const TECHNICAL_DATE_FIELDS = new Set([
  "generatedAt",
  "savedAt",
  "fetchedAt",
  "createdAt",
  "updatedAt",
]);

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalize(value, ancestors = new Set()) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();

  if (ancestors.has(value)) {
    throw new TypeError("Cannot canonicalize a circular structure.");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => canonicalize(entry, ancestors));
    }

    return Object.keys(value)
      .filter((key) => !TECHNICAL_DATE_FIELDS.has(key))
      .sort(compareStrings)
      .reduce((result, key) => {
        result[key] = canonicalize(value[key], ancestors);
        return result;
      }, {});
  } finally {
    ancestors.delete(value);
  }
}

function normalizeOptions(options, positionalGetIdentity) {
  const normalized = typeof options === "function"
    ? { extractEntries: options, getIdentity: positionalGetIdentity }
    : { ...(options || {}) };

  if (typeof normalized.extractEntries !== "function") {
    throw new TypeError("extractEntries must be a function.");
  }
  if (normalized.getIdentity !== undefined && typeof normalized.getIdentity !== "function") {
    throw new TypeError("getIdentity must be a function when provided.");
  }

  return normalized;
}

function serialize(value, label) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError(`${label} must be JSON-serializable.`);
  }
  return serialized;
}

function prepareEntries(dataset, options) {
  const extracted = dataset === null || dataset === undefined
    ? []
    : options.extractEntries(dataset);

  if (!Array.isArray(extracted)) {
    throw new TypeError("extractEntries must return an array.");
  }

  const entries = extracted.map((extractedEntry, index) => {
    let key;
    let value;

    if (options.getIdentity) {
      key = options.getIdentity(extractedEntry, index, dataset);
      value = extractedEntry;
    } else {
      const isKeyedEntry = extractedEntry
        && typeof extractedEntry === "object"
        && Object.prototype.hasOwnProperty.call(extractedEntry, "key")
        && Object.prototype.hasOwnProperty.call(extractedEntry, "value");

      if (!isKeyedEntry) {
        throw new TypeError(
          "extractEntries entries must be { key, value } objects when getIdentity is not provided.",
        );
      }

      ({ key, value } = extractedEntry);
    }

    const canonicalKey = canonicalize(key);
    const canonicalValue = canonicalize(value);

    return {
      key: canonicalKey,
      value: canonicalValue,
      keySerialized: serialize(canonicalKey, `Entry identity at index ${index}`),
      valueSerialized: serialize(canonicalValue, `Entry value at index ${index}`),
    };
  });

  return entries.sort((left, right) => (
    compareStrings(left.keySerialized, right.keySerialized)
    || compareStrings(left.valueSerialized, right.valueSerialized)
  ));
}

function hashEntries(entries) {
  const payload = entries.map(({ key, value }) => [key, value]);
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function computeDatasetHash(dataset, options, positionalGetIdentity) {
  const normalizedOptions = normalizeOptions(options, positionalGetIdentity);
  return hashEntries(prepareEntries(dataset, normalizedOptions));
}

function groupEntriesByKey(entries) {
  return entries.reduce((groups, entry) => {
    const group = groups.get(entry.keySerialized) || [];
    group.push(entry);
    groups.set(entry.keySerialized, group);
    return groups;
  }, new Map());
}

function removeUnchangedEntries(previousEntries, nextEntries) {
  const previousByValue = groupEntriesByValue(previousEntries);
  const nextByValue = groupEntriesByValue(nextEntries);
  const valueKeys = new Set([...previousByValue.keys(), ...nextByValue.keys()]);
  const remainingPrevious = [];
  const remainingNext = [];

  for (const valueKey of [...valueKeys].sort(compareStrings)) {
    const previous = previousByValue.get(valueKey) || [];
    const next = nextByValue.get(valueKey) || [];
    const unchangedCount = Math.min(previous.length, next.length);
    remainingPrevious.push(...previous.slice(unchangedCount));
    remainingNext.push(...next.slice(unchangedCount));
  }

  return { remainingPrevious, remainingNext };
}

function groupEntriesByValue(entries) {
  return entries.reduce((groups, entry) => {
    const group = groups.get(entry.valueSerialized) || [];
    group.push(entry);
    groups.set(entry.valueSerialized, group);
    return groups;
  }, new Map());
}

function diffPreparedEntries(previousEntries, nextEntries) {
  const previousByKey = groupEntriesByKey(previousEntries);
  const nextByKey = groupEntriesByKey(nextEntries);
  const keySet = new Set([...previousByKey.keys(), ...nextByKey.keys()]);
  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const key of [...keySet].sort(compareStrings)) {
    const previousGroup = previousByKey.get(key) || [];
    const nextGroup = nextByKey.get(key) || [];
    const { remainingPrevious, remainingNext } = removeUnchangedEntries(previousGroup, nextGroup);
    const modifiedCount = Math.min(remainingPrevious.length, remainingNext.length);

    modified += modifiedCount;
    removed += remainingPrevious.length - modifiedCount;
    added += remainingNext.length - modifiedCount;
  }

  return { added, removed, modified };
}

function diffDatasets(previousDataset, nextDataset, options, positionalGetIdentity) {
  const normalizedOptions = normalizeOptions(options, positionalGetIdentity);
  const previousEntries = prepareEntries(previousDataset, normalizedOptions);
  const nextEntries = prepareEntries(nextDataset, normalizedOptions);
  const previousHash = hashEntries(previousEntries);
  const newHash = hashEntries(nextEntries);
  const { added, removed, modified } = diffPreparedEntries(previousEntries, nextEntries);

  return {
    previousHash,
    newHash,
    changed: previousHash !== newHash,
    added,
    removed,
    modified,
  };
}

module.exports = {
  canonicalize,
  computeDatasetHash,
  diffDatasets,
};
