const { createApp } = require("./app");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { env } = require("./config/env");

async function start() {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Pokémon GO API disponible sur ${env.publicUrl}`);
    console.log(`Documentation : ${env.publicUrl}/api-docs`);
    console.log(`Swagger interactif : ${env.publicUrl}/swagger`);
  });

  async function shutdown(signal) {
    console.log(`${signal} reçu, arrêt en cours...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
