const test = require("node:test");
const assert = require("node:assert/strict");
const checklistHandler = require("../api/checklist-v3");

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

test("GET /api/checklist-v3 renvoie la checklist publique et le catalogue", async () => {
  const request = {
    method: "GET",
    headers: {},
    query: {},
  };
  const response = createResponse();

  await checklistHandler(request, response);

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.body.data.entries));
  assert.equal(typeof response.body.data.catalog.types, "number");
  assert.equal(response.body.data.viewer.admin, false);
});

test("POST /api/checklist-v3 bootstrap ignore les règles perso publiques", async () => {
  const request = {
    method: "POST",
    headers: {},
    body: {
      action: "bootstrap",
      customRules: [{ enabled: true, name: "Descriptions" }],
    },
    query: {},
  };
  const response = createResponse();

  await checklistHandler(request, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.customRules, []);
});

test("POST /api/checklist-v3 preview-rule est migré hors API publique", async () => {
  const request = {
    method: "POST",
    headers: {},
    body: {
      action: "preview-rule",
      name: "Descriptions",
      appliesTo: ["pokemon"],
      templateSource: 'description: { fr: "", en: "" }',
    },
    query: {},
  };
  const response = createResponse();

  await checklistHandler(request, response);

  assert.equal(response.statusCode, 410);
  assert.match(response.body.error, /read-only/);
});

test("POST /api/checklist-v3 login est désactivé en read-only", async () => {
  const response = createResponse();

  await checklistHandler(
    {
      method: "POST",
      headers: {},
      body: { action: "login", password: "test-checklist" },
      query: {},
    },
    response,
  );

  assert.equal(response.statusCode, 410);
  assert.equal(response.headers["set-cookie"], undefined);
  assert.match(response.body.error, /dashboard_Admin/);
});
