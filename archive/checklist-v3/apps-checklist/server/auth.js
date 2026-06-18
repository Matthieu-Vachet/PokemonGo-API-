const crypto = require("crypto");

function isAuthorized(request) {
  const expected = process.env.CHECKLIST_PASSWORD || "";
  const supplied = String(request.headers["x-checklist-password"] || "");
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length > 0 &&
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function requireAuth(request, response) {
  if (isAuthorized(request)) return true;

  response.setHeader("Cache-Control", "private, no-store");
  response.status(401).json({ error: "Mot de passe requis." });
  return false;
}

module.exports = { requireAuth };
