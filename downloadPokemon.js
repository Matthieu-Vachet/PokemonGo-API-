const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ==============================
// CONFIG
// ==============================

const MAX_POKEMON = 1025;

// ==============================
// FORMAT ID
// ==============================

function formatId(id) {
  return String(id).padStart(4, "0");
}

// ==============================
// CREATE SLUG
// ==============================

function createSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// ==============================
// ENSURE DIRECTORY EXISTS
// ==============================

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ==============================
// DOWNLOAD FUNCTION
// ==============================

async function downloadPokemon(id) {
  try {
    const url = `https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex/id/${id}.json`;

    console.log(`📡 Downloading Pokémon ${id}`);

    const response = await axios.get(url);

    const data = response.data;

    // ==============================
    // CREATE FILE NAME
    // ==============================

    const name = data.names.English;

    const slug = createSlug(name);

    const filename = `${formatId(id)}-${slug}.json`;

    // ==============================
    // SAVE PATH
    // ==============================

    const pokemonDir = path.join(__dirname, "data/pokemon");
    const filePath = path.join(pokemonDir, filename);

    // Ensure directory exists
    ensureDirectoryExists(pokemonDir);

    // ==============================
    // WRITE FILE
    // ==============================

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    console.log(`✅ Saved ${filename}`);
  } catch (error) {
    console.log(`❌ Pokémon ${id} not found`);
  }
}

// ==============================
// MAIN LOOP
// ==============================

async function main() {
  for (let i = 1; i <= MAX_POKEMON; i++) {
    await downloadPokemon(i);
  }
}

main();
