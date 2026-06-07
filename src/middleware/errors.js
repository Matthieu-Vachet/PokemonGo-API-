const { ApiError } = require("../lib/api-error");

function notFound(request, _response, next) {
  next(
    new ApiError(
      404,
      `Route introuvable : ${request.method} ${request.originalUrl}`,
      "ROUTE_NOT_FOUND",
    ),
  );
}

function errorHandler(error, request, response, _next) {
  const status = error instanceof ApiError ? error.status : 500;
  const body = {
    error: {
      code: error.code || "INTERNAL_ERROR",
      message:
        status === 500 && process.env.NODE_ENV === "production"
          ? "Erreur interne du serveur."
          : error.message,
      requestId: request.id,
    },
  };
  if (error.details !== undefined) body.error.details = error.details;
  if (status >= 500) console.error(error);
  response.status(status).json(body);
}

module.exports = { errorHandler, notFound };
