const { createApp } = require("../src/app");
const { connectDatabase } = require("../src/config/database");

const app = createApp();

module.exports = async function handler(request, response) {
  await connectDatabase();
  return app(request, response);
};
