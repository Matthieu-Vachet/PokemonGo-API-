const { createApp } = require("../../src/app");
const { connectDatabase } = require("../../src/config/database");

const app = createApp();

async function handler(request, response) {
  await connectDatabase();
  return app(request, response);
}

module.exports = handler;
module.exports.default = handler;
