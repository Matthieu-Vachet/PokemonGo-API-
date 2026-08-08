const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const activeDocuments = [
  "README.md",
  "CHANGELOG.md",
  "GUIDE_DE_LECTURE.md",
  "docs/API.md",
  "docs/CANONICAL-DATA-CONTRACTS.md",
  "docs/DATA-NORMALIZATION.md",
  "docs/ENTITY-CATEGORY-ARCHITECTURE.md",
  "docs/GIT-WORKFLOW.md",
  "docs/IDENTITY-MANAGER.md",
  "docs/JAVASCRIPT-FILES.md",
  "docs/MAINTENANCE.md",
  "docs/MONGO-IMPORT.md",
  "docs/PROJECT-STRUCTURE.md",
  "docs/RANKED-DATASETS.md",
  "docs/SCHEMA.md",
  "docs/TEMPLATES.md",
];
const permanentId = /^(?:RULE|ADR|API|DATASET|PROVIDER|PAGE|COMP|COL)-[A-Z0-9-]+-\d{3}$/;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function frontmatter(source, relativePath) {
  assert.ok(source.startsWith("---\n"), `${relativePath}: frontmatter YAML absent`);
  const end = source.indexOf("\n---\n", 4);
  assert.ok(end > 4, `${relativePath}: frontmatter YAML non fermé`);
  return source.slice(4, end);
}

function scalar(yaml, key, relativePath) {
  const match = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  assert.ok(match, `${relativePath}: champ ${key} absent`);
  return match[1].trim();
}

test("les documents actifs portent un frontmatter permanent et versionné", () => {
  const ids = new Set();
  for (const relativePath of activeDocuments) {
    const yaml = frontmatter(read(relativePath), relativePath);
    const id = scalar(yaml, "id", relativePath);
    assert.match(id, permanentId, `${relativePath}: identifiant permanent invalide`);
    assert.equal(ids.has(id), false, `${relativePath}: identifiant permanent dupliqué`);
    ids.add(id);
    assert.ok(scalar(yaml, "title", relativePath));
    assert.match(scalar(yaml, "status", relativePath), /^(?:active|canonical)$/);
    assert.equal(scalar(yaml, "lang", relativePath), "fr");
    assert.match(scalar(yaml, "version", relativePath), /^\d+\.\d+\.\d+$/);
    assert.match(scalar(yaml, "updated_at", relativePath), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(scalar(yaml, "author", relativePath), "MatWeb Innovation");
    assert.match(yaml, /^projects:\n(?:  - .+\n?)+/m, `${relativePath}: projets absents`);
    assert.match(yaml, /^related:\n(?:  - .+\n?)+/m, `${relativePath}: relations absentes`);
  }
});

test("le contrat canonique couvre les règles de publication obligatoires", () => {
  const contract = read("docs/CANONICAL-DATA-CONTRACTS.md");
  for (const id of [
    "RULE-CANONICAL-001",
    "ADR-CANONICAL-001",
    "API-POKEMON-001",
    "DATASET-POKEMON-001",
    "PROVIDER-PVPOKE-001",
    "PAGE-ADMIN-CONTROLS-001",
    "COMP-ENGINE-001",
    "COL-POKEMON-001",
  ]) {
    assert.match(contract, new RegExp(`\\b${id}\\b`));
  }
  for (const subject of [
    "donnée **canonique**",
    "donnée **dérivée**",
    "donnée **fournisseur**",
    "synchronisation PvPoke mensuelle",
    "Identity Manager",
    "Veille",
    "Bonbons",
    "fallback explicite",
    "OpenAPI",
    "SemVer",
    "Dépréciation et rollback",
  ]) {
    assert.ok(contract.includes(subject), `contrat incomplet: ${subject}`);
  }
});

test("la documentation active ne réintroduit aucune architecture retirée", () => {
  const corpus = activeDocuments.map(read).join("\n");
  assert.doesNotMatch(corpus, /pokemon-assets\/(?:core|home|shuffle|location-cards|variants)\/\d{4}-/);
  assert.doesNotMatch(corpus, /pvp\/pokemon\/\d{4}-/);
  assert.doesNotMatch(corpus, /^\s*"pvp"\s*:/m);
  assert.doesNotMatch(corpus, /^# Vérification Pokémon$/m);
  assert.doesNotMatch(corpus, /## Roadmap Possible/);
});
