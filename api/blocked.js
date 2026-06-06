module.exports = function handler(_request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.status(404).json({ error: "Fichier introuvable." });
};
