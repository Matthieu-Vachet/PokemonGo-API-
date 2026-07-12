const test = require("node:test");
const assert = require("node:assert/strict");
const ShinySnapshot = require("../src/models/shiny-snapshot");

test("les snapshots Shiny conservent données, provenance et hash", () => {
  assert.equal(ShinySnapshot.collection.collectionName, "shiny_snapshots");
  const snapshot = new ShinySnapshot({
    snapshotAt: new Date("2026-07-12T00:00:00.000Z"),
    sourceHash: "hash",
    count: 1,
    source: { provider: "snacknap" },
    diagnostics: { warnings: [] },
    data: { rankings: { today: [{}], total: [{}], rare: [{}] } },
  });
  assert.equal(snapshot.domain, undefined);
  snapshot.domain = "shiny";
  assert.equal(snapshot.validateSync(), undefined);
});
