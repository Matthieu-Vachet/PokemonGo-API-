const mongoose = require("mongoose");
const { env } = require("./env");

mongoose.set("strictQuery", true);

let connectionPromise;

async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI est requis pour démarrer l'API.");
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(env.mongoUri, {
        autoIndex: !env.isProduction,
        maxPoolSize: 20,
        minPoolSize: env.isProduction ? 2 : 0,
        serverSelectionTimeoutMS: 10000,
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }
  await connectionPromise;
  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  connectionPromise = null;
}

function databaseStatus() {
  const labels = ["disconnected", "connected", "connecting", "disconnecting"];
  return labels[mongoose.connection.readyState] || "unknown";
}

module.exports = { connectDatabase, disconnectDatabase, databaseStatus };
