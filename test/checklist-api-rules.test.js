const test = require("node:test");
const assert = require("node:assert/strict");
const checklistHandler = require("../api/checklist-v3");

function withAdminSecret(value) {
  const previous = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = value;
  return () => {
    if (previous === undefined) delete process.env.API_ADMIN_SECRET;
    else process.env.API_ADMIN_SECRET = previous;
  };
}

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
  assert.deepEqual(response.body.data.customRules, []);
});

test("POST /api/checklist-v3 bootstrap est refusé par l'API publique", async () => {
  const restoreSecret = withAdminSecret("test-secret");
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
  restoreSecret();

  assert.equal(response.statusCode, 401);
  assert.match(response.body.error, /x-api-admin-secret/);
});

test("POST /api/checklist-v3 preview-rule refuse un secret admin invalide", async () => {
  const restoreSecret = withAdminSecret("test-secret");
  const request = {
    method: "POST",
    headers: { "x-api-admin-secret": "wrong-secret" },
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
  restoreSecret();

  assert.equal(response.statusCode, 403);
  assert.match(response.body.error, /Secret admin invalide/);
});

test("POST /api/checklist-v3 login est désactivé en read-only", async () => {
  const restoreSecret = withAdminSecret("test-secret");
  const response = createResponse();

  await checklistHandler(
    {
      method: "POST",
      headers: { "x-api-admin-secret": "test-secret" },
      body: { action: "login", password: "test-checklist" },
      query: {},
    },
    response,
  );
  restoreSecret();

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, "GET, HEAD, OPTIONS");
  assert.equal(response.headers["set-cookie"], undefined);
  assert.match(response.body.error, /Méthode non autorisée/);
});

test("GET /api/checklist-v3 history est une action interne protégée", async () => {
  const restoreSecret = withAdminSecret("test-secret");
  const response = createResponse();

  await checklistHandler(
    {
      method: "GET",
      headers: {},
      query: { action: "history" },
    },
    response,
  );

  restoreSecret();
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error, /x-api-admin-secret/);
});
