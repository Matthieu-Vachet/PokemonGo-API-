class ApiError extends Error {
  constructor(status, message, code = "API_ERROR", details = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = { ApiError };
