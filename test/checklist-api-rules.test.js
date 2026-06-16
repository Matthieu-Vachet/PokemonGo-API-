const test = require("node:test");
const assert = require("node:assert/strict");
const checklistHandler = require("../api/checklist-v3");
const previewHandler = require("../api/custom-rules-v3/preview");
const { previewCustomRule } = require("../apps/checklist/server/custom-rules");

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const originalPassword = process.env.CHECKLIST_PASSWORD;

test.before(() => {
  process.env.CHECKLIST_PASSWORD = "test-checklist";
});

test.after(() => {
  if (originalPassword === undefined) delete process.env.CHECKLIST_PASSWORD;
  else process.env.CHECKLIST_PASSWORD = originalPassword;
});

test("l'API de prévisualisation normalise une règle template", () => {
  const request = {
    method: "POST",
    headers: { "x-checklist-password": "test-checklist" },
    body: {
      name: "Descriptions",
      appliesTo: ["pokemon"],
      templateSource: 'description: { fr: "", en: "" }',
    },
  };
  const response = createResponse();

  previewHandler(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.mode, "template");
  assert.deepEqual(response.body.data.template, {
    description: { fr: "", en: "" },
  });
});

test("POST /api/checklist-v3 applique des règles perso envoyées par le client", () => {
  const customRule = previewCustomRule({
    name: "Descriptions",
    appliesTo: ["pokemon"],
    templateSource: 'description: { fr: "", en: "" }',
  });
  const request = {
    method: "POST",
    headers: { "x-checklist-password": "test-checklist" },
    body: {
      customRules: [customRule],
    },
  };
  const response = createResponse();

  checklistHandler(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.customRules.length, 1);
  const bulbasaur = response.body.entries.find(
    (entry) => entry.file === "data/pokemon/0001-bulbasaur.json",
  );
  assert.ok(bulbasaur);
  assert.ok(
    bulbasaur.issues.some(
      (issue) => issue.path === "description" && issue.category === "custom",
    ),
  );
});
