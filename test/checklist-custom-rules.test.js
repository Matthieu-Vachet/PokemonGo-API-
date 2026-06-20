const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { dataPath } = require("../src/lib/data-repository");
const {
  buildSuggestedPatch,
  validateSourceData,
} = require("../apps/checklist/server/engine");
const {
  previewCustomRule,
  rulesFile,
  saveCustomRule,
} = require("../apps/checklist/server/custom-rules");

const bulbasaurFile = dataPath("pokemon", "0001-bulbasaur.json");
const bulbasaur = JSON.parse(fs.readFileSync(bulbasaurFile, "utf8"));
const originalRules = fs.existsSync(rulesFile)
  ? fs.readFileSync(rulesFile, "utf8")
  : null;

function resetRules() {
  fs.mkdirSync(path.dirname(rulesFile), { recursive: true });
  fs.writeFileSync(
    rulesFile,
    `${JSON.stringify({ version: 1, updatedAt: null, rules: [] }, null, 2)}\n`,
  );
}

test.beforeEach(() => {
  resetRules();
});

test.after(() => {
  if (originalRules === null) fs.rmSync(rulesFile, { force: true });
  else fs.writeFileSync(rulesFile, originalRules);
});

test("les règles custom prévisualisent un bloc souple de type description", () => {
  const rule = previewCustomRule({
    name: "Descriptions multilingues",
    appliesTo: ["pokemon"],
    templateSource: 'description: { fr: "", en: "" }',
  });
  assert.equal(rule.mode, "template");
  assert.deepEqual(rule.appliesTo, ["pokemon"]);
  assert.deepEqual(rule.template, {
    description: { fr: "", en: "" },
  });
});

test("une règle custom ajoute des problèmes et un patch suggéré", () => {
  saveCustomRule({
    name: "Descriptions multilingues",
    appliesTo: ["pokemon"],
    templateSource: 'description: { fr: "", en: "" }',
  });

  const issues = validateSourceData(
    bulbasaur,
    "data/pokemon/0001-bulbasaur.json",
  );
  const descriptionIssue = issues.find((issue) => issue.path === "description");

  assert.ok(descriptionIssue);
  assert.equal(descriptionIssue.category, "custom");
  assert.equal(descriptionIssue.ruleName, "Descriptions multilingues");
  assert.deepEqual(descriptionIssue.suggested, { fr: "", en: "" });

  const patch = buildSuggestedPatch([descriptionIssue], "pokemon");
  assert.deepEqual(patch, {
    description: { fr: "", en: "" },
  });
});
