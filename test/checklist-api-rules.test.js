const test = require("node:test");
const assert = require("node:assert/strict");
const checklistHandler = require("../api/checklist-v3");
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

test("POST /api/checklist-v3 bootstrap refuse les règles perso publiques", async () => {
  const customRule = previewCustomRule({
    name: "Descriptions",
    appliesTo: ["pokemon"],
    templateSource: 'description: { fr: "", en: "" }',
  });
  const request = {
    method: "POST",
    headers: {},
    body: {
      action: "bootstrap",
      customRules: [customRule],
    },
    query: {},
  };
  const response = createResponse();

  await checklistHandler(request, response);

  assert.equal(response.statusCode, 401);
});

test("POST /api/checklist-v3 preview-rule exige un accès admin", async () => {
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

  assert.equal(response.statusCode, 401);
});

test("POST /api/checklist-v3 login ouvre une session admin", async () => {
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

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["set-cookie"], /pokedex_admin_session=/);
  assert.equal(response.body.data.authenticated, true);
});
