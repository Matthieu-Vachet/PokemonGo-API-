const { requireAdmin } = require("../lib/checklist-auth");

function adminOnly(request, response, next) {
  if (!requireAdmin(request, response)) return;
  next();
}

function readOnlyPublic(request, response, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  if (!requireAdmin(request, response)) return;
  next();
}

module.exports = {
  adminOnly,
  readOnlyPublic,
};
