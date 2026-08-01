const crypto = require("node:crypto");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const MIGRATION_ID = "2026-07-31-retire-ma-collection";
const ARCHIVE_COLLECTION = "migration_retired_features_archive";
const MANIFEST_COLLECTION = "migration_manifests";
const RETIRED_VALUES = new Set(["ma-collection", "ma_collection", "my-collection", "my_collection"]);
const mode = process.argv.includes("--restore") ? "restore" : process.argv.includes("--write") ? "write" : "dry-run";

function normalizedRetiredValue(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function isRetiredValue(value) {
  return typeof value === "string" && RETIRED_VALUES.has(normalizedRetiredValue(value));
}

function containsRetiredFeature(value) {
  if (isRetiredValue(value)) return true;
  if (Array.isArray(value)) return value.some(containsRetiredFeature);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsRetiredFeature);
}

function stripRetiredFeature(value, parentKey = "") {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => !(parentKey === "aliases" && entry && typeof entry === "object" && isRetiredValue(entry.provider)))
      .filter((entry) => !(parentKey === "activeAliasKeys" && typeof entry === "string" && normalizedRetiredValue(entry.split(":")[0]) === "ma-collection"))
      .map((entry) => stripRetiredFeature(entry, parentKey));
  }
  if (!value || typeof value !== "object") return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (["identityProvider", "collectionProvider", "collectionSource", "collectionIdentity"].includes(key) && isRetiredValue(entry)) continue;
    if (key === "provider" && isRetiredValue(entry)) continue;
    output[key] = stripRetiredFeature(entry, key);
  }
  return output;
}

function documentDigest(document) {
  return crypto.createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

async function matchingDocuments(database, collectionName, allDocuments = false) {
  const documents = await database.collection(collectionName).find({}).toArray();
  return allDocuments ? documents : documents.filter(containsRetiredFeature);
}

async function inventory(defaultDb, dashboardDb) {
  const plans = [
    { database: defaultDb, databaseName: defaultDb.databaseName, collection: "pokemon_identities", action: "sanitize", all: false },
    { database: defaultDb, databaseName: defaultDb.databaseName, collection: "pokemon_identity_diagnostics", action: "delete", all: false },
    { database: defaultDb, databaseName: defaultDb.databaseName, collection: "pokemon_identity_history", action: "delete", all: false },
    { database: dashboardDb, databaseName: dashboardDb.databaseName, collection: "trainer_pokemon_entries", action: "delete", all: true },
    { database: dashboardDb, databaseName: dashboardDb.databaseName, collection: "trainer_pokemon_snapshots", action: "delete", all: true },
    { database: dashboardDb, databaseName: dashboardDb.databaseName, collection: "trainer_pokemon_owners", action: "delete", all: true },
    { database: dashboardDb, databaseName: dashboardDb.databaseName, collection: "events_archive", action: "sanitize", all: false },
  ];
  for (const plan of plans) plan.documents = await matchingDocuments(plan.database, plan.collection, plan.all);
  return plans;
}

async function archivePlan(plan) {
  if (!plan.documents.length) return 0;
  const archive = plan.database.collection(ARCHIVE_COLLECTION);
  await archive.createIndex({ migrationId: 1, sourceCollection: 1, sourceId: 1 }, { unique: true });
  const archivedAt = new Date();
  const operations = plan.documents.map((document) => ({
    updateOne: {
      filter: { migrationId: MIGRATION_ID, sourceCollection: plan.collection, sourceId: String(document._id) },
      update: { $setOnInsert: { migrationId: MIGRATION_ID, database: plan.databaseName, sourceCollection: plan.collection, sourceId: String(document._id), digest: documentDigest(document), archivedAt, document } },
      upsert: true,
    },
  }));
  await archive.bulkWrite(operations, { ordered: false });
  const backedUp = await archive.countDocuments({ migrationId: MIGRATION_ID, sourceCollection: plan.collection, sourceId: { $in: plan.documents.map((document) => String(document._id)) } });
  if (backedUp !== plan.documents.length) throw new Error(`Sauvegarde incomplète pour ${plan.databaseName}.${plan.collection}: ${backedUp}/${plan.documents.length}.`);
  return backedUp;
}

async function applyPlan(plan) {
  if (!plan.documents.length) return 0;
  const collection = plan.database.collection(plan.collection);
  if (plan.action === "delete") {
    const result = await collection.deleteMany({ _id: { $in: plan.documents.map((document) => document._id) } });
    return result.deletedCount;
  }
  const operations = plan.documents.map((document) => ({
    replaceOne: { filter: { _id: document._id }, replacement: stripRetiredFeature(document), upsert: false },
  }));
  const result = await collection.bulkWrite(operations, { ordered: false });
  return result.modifiedCount;
}

async function recordManifest(plans, status) {
  const byDatabase = new Map();
  for (const plan of plans) {
    const entries = byDatabase.get(plan.databaseName) || [];
    entries.push({ collection: plan.collection, action: plan.action, documents: plan.documents.length });
    byDatabase.set(plan.databaseName, entries);
  }
  const processed = new Set();
  for (const plan of plans) {
    if (processed.has(plan.databaseName)) continue;
    processed.add(plan.databaseName);
    const manifest = plan.database.collection(MANIFEST_COLLECTION);
    await manifest.updateOne(
      { migrationId: MIGRATION_ID },
      { $set: { migrationId: MIGRATION_ID, feature: "Ma collection", historicalOnly: true, status, updatedAt: new Date(), collections: byDatabase.get(plan.databaseName) || [] }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  }
}

async function restoreDatabase(database) {
  const archive = database.collection(ARCHIVE_COLLECTION);
  const archived = await archive.find({ migrationId: MIGRATION_ID }).toArray();
  const grouped = new Map();
  for (const item of archived) {
    const values = grouped.get(item.sourceCollection) || [];
    values.push(item);
    grouped.set(item.sourceCollection, values);
  }
  const restored = {};
  for (const [collectionName, items] of grouped) {
    const operations = items.map((item) => ({ replaceOne: { filter: { _id: item.document._id }, replacement: item.document, upsert: true } }));
    if (operations.length) await database.collection(collectionName).bulkWrite(operations, { ordered: false });
    restored[collectionName] = operations.length;
  }
  await database.collection(MANIFEST_COLLECTION).updateOne({ migrationId: MIGRATION_ID }, { $set: { status: "restored", restoredAt: new Date(), restored } });
  return restored;
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI est requis.");
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const defaultDbName = process.env.POKEMON_IDENTITY_DB || "pokemon-go-api";
    const dashboardDbName = process.env.DASHBOARD_MONGODB_DB || "matweb-dashboard-admin";
    const defaultDb = client.db(defaultDbName);
    const dashboardDb = client.db(dashboardDbName);
    if (mode === "restore") {
      const restored = { [defaultDbName]: await restoreDatabase(defaultDb), [dashboardDbName]: await restoreDatabase(dashboardDb) };
      console.log(JSON.stringify({ migrationId: MIGRATION_ID, mode, restored }, null, 2));
      return;
    }

    const plans = await inventory(defaultDb, dashboardDb);
    const report = { migrationId: MIGRATION_ID, mode, backupCollection: ARCHIVE_COLLECTION, historicalReferencesAllowedOnlyIn: [ARCHIVE_COLLECTION, MANIFEST_COLLECTION], plans: plans.map((plan) => ({ database: plan.databaseName, collection: plan.collection, action: plan.action, documents: plan.documents.length })) };
    if (mode === "dry-run") {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    for (const plan of plans) plan.backedUp = await archivePlan(plan);
    for (const plan of plans) plan.changed = await applyPlan(plan);
    await recordManifest(plans, "applied");
    const postPlans = await inventory(defaultDb, dashboardDb);
    const remaining = postPlans.reduce((total, plan) => total + plan.documents.length, 0);
    if (remaining) throw new Error(`${remaining} référence(s) active(s) subsistent après la migration.`);
    console.log(JSON.stringify({ ...report, status: "applied", results: plans.map((plan) => ({ database: plan.databaseName, collection: plan.collection, backedUp: plan.backedUp, changed: plan.changed })), remainingActiveReferences: remaining }, null, 2));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(JSON.stringify({ migrationId: MIGRATION_ID, mode, error: error.message }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = { containsRetiredFeature, isRetiredValue, stripRetiredFeature };
