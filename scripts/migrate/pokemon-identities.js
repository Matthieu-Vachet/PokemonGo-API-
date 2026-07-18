const fs = require("node:fs");
const path = require("node:path");
const { connectDatabase, disconnectDatabase } = require("../../src/config/database");
const { appPath } = require("../../src/lib/data-repository");
const { PokemonIdentity, PokemonIdentityDiagnostic, PokemonIdentityHistory } = require("../../src/models");
const syncService = require("../../src/services/pokemon-identity-sync-service");

const write = process.argv.includes("--write");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function backupCurrentCollection(plan) {
  const directory = appPath("..", ".backup", "pokemon-identities-mongodb");
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${timestamp()}-before-sync.json`);
  const identities = await PokemonIdentity.find({}).select("+activeAliasKeys").lean();
  fs.writeFileSync(file, `${JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    inventoryFingerprint: plan.inventory.fingerprint,
    identities,
  }, null, 2)}\n`);
  return path.relative(appPath(), file).replace(/\\/g, "/");
}

async function run() {
  await connectDatabase();
  const plan = await syncService.previewIdentitySync({ forceInventory: true });
  const report = syncService.reportFromPlan(plan, write ? "write-pending" : "dry-run");
  report.planDigest = syncService.syncPlanDigest(plan);
  report.backup = null;
  report.idempotence = null;

  if (!write) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (plan.conflicts.length) throw Object.assign(new Error("Le dry-run contient des conflits; aucune écriture effectuée."), { details: plan.conflicts });
  report.backup = await backupCurrentCollection(plan);
  const applied = await syncService.applyIdentitySync({ requestedBy: "sync:pokemon-identities", forceInventory: false });
  await Promise.all([
    PokemonIdentity.syncIndexes(),
    PokemonIdentityDiagnostic.syncIndexes(),
    PokemonIdentityHistory.syncIndexes(),
  ]);
  const secondPlan = await syncService.previewIdentitySync({ forceInventory: false });
  report.mode = "write";
  report.applied = applied;
  report.idempotence = {
    create: secondPlan.summary.create,
    update: secondPlan.summary.update,
    orphan: secondPlan.summary.orphan,
    conflict: secondPlan.summary.conflict,
    unchanged: secondPlan.summary.unchanged,
    clean: secondPlan.summary.create === 0 && secondPlan.summary.update === 0 && secondPlan.summary.orphan === 0 && secondPlan.summary.conflict === 0,
  };
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({
    error: error.message,
    code: error.code || "IDENTITY_SYNC_FAILED",
    details: error.details || null,
  }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  await disconnectDatabase().catch(() => undefined);
});
