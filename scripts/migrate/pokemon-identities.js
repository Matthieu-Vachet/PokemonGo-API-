const fs = require("fs");
const { connectDatabase, disconnectDatabase } = require("../../src/config/database");
const { dataPath } = require("../../src/lib/data-repository");
const { PokemonIdentity, PokemonIdentityDiagnostic, PokemonIdentityHistory } = require("../../src/models");
const service = require("../../src/services/pokemon-identity-service");

const write = process.argv.includes("--write");

function read(relativePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(dataPath(...relativePath.split("/")), "utf8"));
  } catch {
    return fallback;
  }
}

function token(value) {
  return service.normalizeCanonicalId(value || "normal") || "NORMAL";
}

function canonicalId(mapping) {
  const pokemon = token(mapping.pokemon || `POKEMON_${mapping.pokemonId}`);
  const variant = token(mapping.localCostume || mapping.costume || mapping.localForm || mapping.form || "normal");
  return variant === pokemon || variant === `${pokemon}_NORMAL` || variant === "NORMAL"
    ? `${pokemon}_NORMAL`
    : variant.startsWith(`${pokemon}_`) ? variant : `${pokemon}_${variant}`;
}

function buildMigrationPlan() {
  const aliases = read("mappings/pokemonVariantAliases.json", { aliases: [] }).aliases || [];
  const mappings = read("game-master/gameMasterPokemonMappings.json", { mappings: [] }).mappings || [];
  const grouped = new Map();
  const invalid = [];

  for (const mapping of mappings) {
    const pokemonId = Number(mapping.pokemonId);
    if (!pokemonId || !["matched", "local-only"].includes(mapping.mappingStatus)) continue;
    const id = canonicalId(mapping);
    if (!grouped.has(id)) {
      grouped.set(id, {
        canonicalId: id,
        pokemonId,
        form: mapping.localForm || null,
        costume: mapping.localCostume || mapping.costume || null,
        status: "active",
        aliases: [],
        genderVariants: { male: false, female: false },
        localReference: {
          key: mapping.localIdentityKey || null,
          formId: mapping.localPokemonFormId || mapping.localIdentity || null,
          file: mapping.localFile || null,
          assetsRef: mapping.localAssetsRef || null,
        },
        metadata: { notes: "Migré depuis gameMasterPokemonMappings.json", tags: ["migration-v1"] },
      });
    }
    const identity = grouped.get(id);
    for (const variant of mapping.genderVariants || []) {
      if (variant.isFemale === true) identity.genderVariants.female = true;
      else identity.genderVariants.male = true;
    }
    const rawAlias = String(mapping.form || mapping.templateId || "").trim();
    if (rawAlias && !identity.aliases.some((entry) => entry.provider === "game-master" && service.normalizeAlias(entry.value) === service.normalizeAlias(rawAlias))) {
      identity.aliases.push({ provider: "game-master", value: rawAlias, status: "active", confidence: 1, source: "migration" });
    }
  }

  for (const oldAlias of aliases) {
    const pokemonId = Number(oldAlias.pokemonId);
    const candidates = [...grouped.values()].filter((identity) => identity.pokemonId === pokemonId && (
      !oldAlias.form || [identity.form, identity.costume, identity.canonicalId].some((value) => service.normalizeAlias(value).includes(service.normalizeAlias(oldAlias.form)))
    ));
    if (candidates.length !== 1) {
      invalid.push({ alias: oldAlias.value, provider: oldAlias.source, pokemonId, reason: candidates.length ? "multiple-candidates" : "missing-canonical-identity" });
      continue;
    }
    const provider = service.normalizeProvider(oldAlias.source || "legacy");
    if (!candidates[0].aliases.some((entry) => entry.provider === provider && service.normalizeAlias(entry.value) === service.normalizeAlias(oldAlias.value))) {
      candidates[0].aliases.push({ provider, value: oldAlias.value, status: oldAlias.status === "ignored" ? "ignored" : "active", confidence: 1, source: "migration", reason: oldAlias.reason || null });
    }
  }

  const identities = [...grouped.values()].sort((left, right) => left.pokemonId - right.pokemonId || left.canonicalId.localeCompare(right.canonicalId));
  const aliasOwners = new Map();
  const conflicts = [];
  for (const identity of identities) {
    for (const alias of identity.aliases.filter((entry) => entry.status === "active")) {
      const key = `${service.normalizeProvider(alias.provider)}:${service.normalizeAlias(alias.value)}`;
      if (aliasOwners.has(key) && aliasOwners.get(key) !== identity.canonicalId) conflicts.push({ key, canonicalIds: [aliasOwners.get(key), identity.canonicalId] });
      aliasOwners.set(key, identity.canonicalId);
    }
  }
  return { identities, conflicts, invalid };
}

async function run() {
  const plan = buildMigrationPlan();
  const report = {
    mode: write ? "write" : "dry-run",
    sourcePreserved: true,
    candidates: plan.identities.length,
    aliasesDetected: plan.identities.reduce((sum, identity) => sum + identity.aliases.length, 0),
    identitiesCreated: 0,
    identitiesExisting: 0,
    aliasesImported: 0,
    duplicatesIgnored: 0,
    conflicts: plan.conflicts,
    invalid: plan.invalid,
    notMigrated: plan.invalid.length + plan.conflicts.length,
  };
  if (!write) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (plan.conflicts.length) throw new Error("La migration ne peut pas être appliquée tant que le dry-run contient des conflits.");
  await connectDatabase();
  await Promise.all([
    PokemonIdentity.syncIndexes(),
    PokemonIdentityDiagnostic.syncIndexes(),
    PokemonIdentityHistory.syncIndexes(),
  ]);
  for (const candidate of plan.identities) {
    let identity = await PokemonIdentity.findOne({ canonicalId: candidate.canonicalId });
    if (!identity) {
      const created = await service.createIdentity(candidate, "migration:pokemon-identities-v1");
      identity = await PokemonIdentity.findById(created.id);
      report.identitiesCreated += 1;
      report.aliasesImported += candidate.aliases.length;
      continue;
    }
    report.identitiesExisting += 1;
    for (const alias of candidate.aliases) {
      const normalized = service.normalizeAlias(alias.value);
      if (identity.aliases.some((entry) => entry.provider === service.normalizeProvider(alias.provider) && entry.normalizedValue === normalized)) {
        report.duplicatesIgnored += 1;
        continue;
      }
      await service.addAlias(identity._id, alias, "migration:pokemon-identities-v1");
      report.aliasesImported += 1;
      identity = await PokemonIdentity.findById(identity._id);
    }
  }
  console.log(JSON.stringify(report, null, 2));
  await disconnectDatabase();
}

run().catch(async (error) => {
  console.error(error);
  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
