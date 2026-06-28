const { requireAdminSecret } = require("../lib/admin-auth");

function publicReadOnly(request, response, next) {
  if (request.method === "OPTIONS") {
    response.setHeader("Allow", "GET, HEAD, OPTIONS");
    return response.status(204).end();
  }

  if (request.method === "GET" || request.method === "HEAD") return next();

  requireAdminSecret(request);
  response.setHeader("Allow", "GET, HEAD, OPTIONS");
  return response.status(405).json({
    error: {
      code: "READ_ONLY_API",
      message: "Cette API publique est disponible en lecture seule.",
      requestId: request.id,
    },
  });
}

module.exports = { publicReadOnly };
