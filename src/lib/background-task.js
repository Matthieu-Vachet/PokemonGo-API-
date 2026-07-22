const { waitUntil } = require("@vercel/functions");

function scheduleBackgroundTask(task) {
  if (!task || typeof task.then !== "function") {
    throw new TypeError("Une promesse est requise pour planifier une tâche de fond.");
  }

  if (process.env.VERCEL === "1") {
    waitUntil(task);
    return;
  }

  void task.catch(() => undefined);
}

module.exports = { scheduleBackgroundTask };
