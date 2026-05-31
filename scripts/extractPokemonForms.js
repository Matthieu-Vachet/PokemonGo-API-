const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pokemonDir = path.join(rootDir, 'data', 'pokemon');
const outputDir = path.join(rootDir, 'data', 'pokemon-forms');
const allowedForms = new Set([
  'alola',
  'galar',
  'hisui',
  'paldea',
  'mega',
  'mega-x',
  'mega-y',
  'gigantamax',
]);

function sanitize(value) {
  return String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function objectValues(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return [];
  return Object.entries(value);
}

function sourceAwareForm(formData, parent) {
  return {
    dexId: parent.dexId,
    ...formData,
  };
}

function formSuffix(parent, sourceKey, formData) {
  const baseId = String(parent.id || '').toLowerCase();
  const rawFormId = String(formData.formId || sourceKey || formData.form || '');
  const sanitizedFormId = sanitize(rawFormId);
  const prefix = `${baseId}-`;

  if (sanitizedFormId.startsWith(prefix)) {
    return sanitizedFormId.slice(prefix.length);
  }

  return sanitize(formData.form || sanitizedFormId);
}

function fileNameForPokemonForm(parent, sourceKey, formData) {
  const dexId = parent.dexId || String(parent.dexNr || '').padStart(4, '0');
  const slug = sanitize(parent.slug || parent.id);
  return `${dexId}-${slug}-${formSuffix(parent, sourceKey, formData)}.json`;
}

function fileNameForGigantamax(parent) {
  const dexId = parent.dexId || String(parent.dexNr || '').padStart(4, '0');
  const slug = sanitize(parent.slug || parent.id);
  return `${dexId}-${slug}-gigantamax.json`;
}

const index = {
  generatedAt: new Date().toISOString(),
  sourceDir: path.relative(rootDir, pokemonDir),
  outputDir: path.relative(rootDir, outputDir),
  allowedForms: [...allowedForms],
  counts: {
    sourcePokemonFiles: 0,
    forms: 0,
  },
  forms: [],
};

const pokemonFiles = fs
  .readdirSync(pokemonDir)
  .filter((file) => file.endsWith('.json'))
  .sort();

fs.rmSync(outputDir, { recursive: true, force: true });

for (const pokemonFile of pokemonFiles) {
  const sourcePath = path.join(pokemonDir, pokemonFile);
  const pokemon = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  index.counts.sourcePokemonFiles += 1;

  for (const [formKey, formData] of objectValues(pokemon.regionForms)) {
    if (!allowedForms.has(formData.form)) continue;

    const relativePath = path.join(formData.form, fileNameForPokemonForm(pokemon, formKey, formData));
    const outputPath = path.join(outputDir, relativePath);

    writeJson(outputPath, sourceAwareForm(formData, pokemon));
    index.counts.forms += 1;
    index.forms.push({
      source: 'regionForms',
      sourceFile: path.join('data', 'pokemon', pokemonFile),
      sourceKey: formKey,
      formId: formData.formId || null,
      form: formData.form || null,
      file: path.join('data', 'pokemon-forms', relativePath),
    });
  }

  for (const [formKey, formData] of objectValues(pokemon.megaEvolutions)) {
    if (!allowedForms.has(formData.form)) continue;

    const relativePath = path.join(formData.form, fileNameForPokemonForm(pokemon, formKey, formData));
    const outputPath = path.join(outputDir, relativePath);

    writeJson(outputPath, sourceAwareForm(formData, pokemon));
    index.counts.forms += 1;
    index.forms.push({
      source: 'megaEvolutions',
      sourceFile: path.join('data', 'pokemon', pokemonFile),
      sourceKey: formKey,
      formId: formData.formId || null,
      form: formData.form || null,
      file: path.join('data', 'pokemon-forms', relativePath),
    });
  }

  for (const asset of pokemon.assetForms || []) {
    if (asset.form !== 'gigantamax') continue;

    const formData = {
      id: pokemon.id,
      slug: pokemon.slug,
      formId: `${pokemon.id}_GIGANTAMAX`,
      form: 'gigantamax',
      dexNr: pokemon.dexNr,
      dexId: pokemon.dexId,
      generation: pokemon.generation,
      region: pokemon.region,
      names: pokemon.names,
      assets: {
        image: asset.image,
        shinyImage: asset.shinyImage,
      },
    };
    const relativePath = path.join('gigantamax', fileNameForGigantamax(pokemon));
    const outputPath = path.join(outputDir, relativePath);

    writeJson(outputPath, formData);
    index.counts.forms += 1;
    index.forms.push({
      source: 'assetForms',
      sourceFile: path.join('data', 'pokemon', pokemonFile),
      sourceKey: null,
      formId: formData.formId,
      form: formData.form,
      file: path.join('data', 'pokemon-forms', relativePath),
    });
  }
}

writeJson(path.join(outputDir, 'index.json'), index);

console.log(`Source pokemon files: ${index.counts.sourcePokemonFiles}`);
console.log(`Form files: ${index.counts.forms}`);
console.log(`Output: ${path.relative(rootDir, outputDir)}`);
