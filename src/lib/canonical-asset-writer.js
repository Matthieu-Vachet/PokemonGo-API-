const fs = require("node:fs");
const path = require("node:path");

const { dataPath, dataPathFromRelative, dataRoot, relativeToData } = require("./data-repository");
const {
  entityPaths: { resolveEntityPath },
  separatedAssetRecords: { writeManifest },
} = require("./data-tooling");

const FAMILY_FIELDS = Object.freeze({
  home: "home",
  shuffle: "shuffle",
  variants: "variants",
  "location-cards": "locationCards",
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function identityFields(entity) {
  return {
    schemaVersion: 1,
    id: entity.id,
    formId: entity.formId,
    baseFormId: entity.baseFormId,
    form: entity.form,
    slug: entity.slug,
    dexNr: entity.dexNr,
    dexId: entity.dexId,
  };
}

function referenceFor(entity, family) {
  return resolveEntityPath({ domain: "assets", family, entity });
}

function loadCore(entity) {
  const reference = entity.assetsRef || referenceFor(entity, "core");
  const file = dataPathFromRelative(reference);
  if (!fs.existsSync(file)) throw new Error(`${entity.formId || entity.id}: Core Assets introuvable (${reference}).`);
  return { reference, file, data: readJson(file) };
}

function planFamilyAsset(entity, family, payload) {
  const field = FAMILY_FIELDS[family];
  if (!field) throw new Error(`Famille Assets secondaire inconnue : ${family}`);
  const reference = referenceFor(entity, family);
  const file = dataPathFromRelative(reference);
  const next = payload == null ? null : { ...identityFields(entity), [field]: payload };
  const current = fs.existsSync(file) ? readJson(file) : null;
  return { family, field, reference, file, current, next, changed: !same(current, next) };
}

function writeFamilyAsset(entity, family, payload, { write = false } = {}) {
  const plan = planFamilyAsset(entity, family, payload);
  const core = loadCore(entity);
  const nextCore = { ...core.data, assetRefs: { ...(core.data.assetRefs || {}) } };
  if (plan.next) nextCore.assetRefs[family] = plan.reference;
  else delete nextCore.assetRefs[family];
  if (!Object.keys(nextCore.assetRefs).length) delete nextCore.assetRefs;
  const coreChanged = !same(core.data, nextCore);

  if (write) {
    if (plan.next && plan.changed) atomicWriteJson(plan.file, plan.next);
    if (!plan.next && fs.existsSync(plan.file)) fs.unlinkSync(plan.file);
    if (coreChanged) atomicWriteJson(core.file, nextCore);
  }
  return {
    ...plan,
    coreReference: core.reference,
    coreChanged,
    changed: plan.changed || coreChanged,
  };
}

function updateCoreAssets(entity, patch, { write = false } = {}) {
  const core = loadCore(entity);
  const next = { ...core.data, assets: { ...(core.data.assets || {}), ...patch } };
  const changed = !same(core.data, next);
  if (write && changed) atomicWriteJson(core.file, next);
  return { reference: core.reference, file: core.file, changed, next };
}

function refreshAssetManifest({ write = false } = {}) {
  return write ? writeManifest(dataRoot) : null;
}

module.exports = {
  atomicWriteJson,
  identityFields,
  loadCore,
  planFamilyAsset,
  referenceFor,
  refreshAssetManifest,
  updateCoreAssets,
  writeFamilyAsset,
};
