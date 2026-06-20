const path = require("path");
const chokidar = require("chokidar");
const { connectDatabase, disconnectDatabase } = require("../../src/config/database");
const { dataRoot } = require("../../src/lib/data-repository");
const { syncAll } = require("../../src/sync/sync-service");

let timer;
let syncing = false;
let pending = false;

async function runSync() {
  if (syncing) {
    pending = true;
    return;
  }
  syncing = true;
  try {
    const result = await syncAll();
    console.log(`[sync] ${new Date().toISOString()} ${JSON.stringify(result.counts)}`);
  } catch (error) {
    console.error("[sync] erreur", error);
  } finally {
    syncing = false;
    if (pending) {
      pending = false;
      runSync();
    }
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runSync, 500);
}

async function main() {
  await connectDatabase();
  await runSync();
  const watcher = chokidar.watch(dataRoot, {
    ignoreInitial: true,
    awaitWriteFinish: true,
  });
  watcher.on("add", schedule).on("change", schedule).on("unlink", schedule);
  console.log(`[sync:watch] surveillance de ${dataRoot}`);
}

async function shutdown() {
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exitCode = 1;
});
