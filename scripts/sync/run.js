const { connectDatabase, disconnectDatabase } = require("../../src/config/database");
const { syncAll } = require("../../src/sync/sync-service");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun) await connectDatabase();
  const result = await syncAll({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  if (!dryRun) await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exitCode = 1;
});
