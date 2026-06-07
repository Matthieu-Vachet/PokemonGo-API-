const crypto = require("crypto");

function requestId(request, response, next) {
  request.id = request.headers["x-request-id"] || crypto.randomUUID();
  response.setHeader("X-Request-Id", request.id);
  next();
}

module.exports = { requestId };
