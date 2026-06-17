const crypto = require("crypto");

const cookieName = "pokedex_admin_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

function adminPassword() {
  return String(
    process.env.ADMIN_DASHBOARD_PASSWORD || process.env.CHECKLIST_PASSWORD || "",
  );
}

function secureCompare(expected, supplied) {
  const left = Buffer.from(String(expected || ""));
  const right = Buffer.from(String(supplied || ""));
  return left.length > 0 &&
    left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

function isValidAdminPassword(supplied) {
  return secureCompare(adminPassword(), supplied);
}

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      const key = index >= 0 ? part.slice(0, index).trim() : part;
      const value = index >= 0 ? part.slice(index + 1).trim() : "";
      if (key) cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function sign(payload) {
  return crypto
    .createHmac("sha256", adminPassword())
    .update(payload)
    .digest("hex");
}

function createSessionToken() {
  const payload = `${Date.now()}.${crypto.randomBytes(8).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return false;
  const [issuedAt, nonce, signature] = parts;
  const payload = `${issuedAt}.${nonce}`;
  if (!secureCompare(sign(payload), signature)) return false;
  const age = Date.now() - Number(issuedAt || 0);
  return Number.isFinite(age) && age >= 0 && age <= sessionMaxAgeSeconds * 1000;
}

function isSecureRequest(request) {
  return (
    process.env.NODE_ENV === "production" ||
    String(request.headers["x-forwarded-proto"] || "").includes("https") ||
    Boolean(process.env.VERCEL)
  );
}

function serializeCookie(name, value, request, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

function clearSession(response, request) {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(cookieName, "", request, 0),
  );
}

function setSession(response, request) {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(cookieName, createSessionToken(), request, sessionMaxAgeSeconds),
  );
}

function isAdminRequest(request) {
  if (isValidAdminPassword(request.headers["x-checklist-password"])) return true;
  const cookies = parseCookies(request.headers.cookie || "");
  return verifySessionToken(cookies[cookieName]);
}

function requireAdmin(request, response) {
  if (isAdminRequest(request)) return true;
  response.setHeader("Cache-Control", "private, no-store");
  response.status(401).json({ error: "Accès administrateur requis." });
  return false;
}

module.exports = {
  adminPassword,
  clearSession,
  cookieName,
  isAdminRequest,
  isValidAdminPassword,
  requireAdmin,
  setSession,
};
