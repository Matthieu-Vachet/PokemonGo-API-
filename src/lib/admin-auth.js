const crypto = require("crypto");
const { ApiError } = require("./api-error");

const ADMIN_SECRET_HEADER = "x-api-admin-secret";

function headerValue(request, name) {
  if (typeof request.get === "function") return request.get(name);
  if (typeof request.header === "function") return request.header(name);
  if (typeof request.headers?.get === "function") return request.headers.get(name);
  return request.headers?.[name] || request.headers?.[name.toLowerCase()];
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAdminSecret(request) {
  const configuredSecret = process.env.API_ADMIN_SECRET;
  if (!configuredSecret) {
    throw new ApiError(
      500,
      "API_ADMIN_SECRET est manquant côté serveur.",
      "ADMIN_SECRET_NOT_CONFIGURED",
    );
  }

  const providedSecret = headerValue(request, ADMIN_SECRET_HEADER);
  if (!providedSecret) {
    throw new ApiError(
      401,
      `Header ${ADMIN_SECRET_HEADER} requis pour cette route privée.`,
      "ADMIN_SECRET_REQUIRED",
    );
  }

  if (!safeEquals(String(providedSecret), configuredSecret)) {
    throw new ApiError(403, "Secret admin invalide.", "ADMIN_SECRET_INVALID");
  }

  return true;
}

module.exports = { ADMIN_SECRET_HEADER, requireAdminSecret };
