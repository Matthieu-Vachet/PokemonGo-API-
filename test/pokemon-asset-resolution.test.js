const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolvePreferredPokemonAsset,
  usableImage,
} = require("../src/lib/pokemon-asset-resolution");

function mega(form = "mega") {
  return {
    kind: "mega",
    form,
    data: {
      assets: {
        image: `${form}-go.png`,
        shinyImage: `${form}-go-shiny.png`,
        home: {
          image: `${form}-home.png`,
          shinyImage: `${form}-home-shiny.png`,
        },
        portrait: `${form}-portrait.png`,
        portraitShiny: `${form}-portrait-shiny.png`,
      },
    },
  };
}

test("les Méga préfèrent Pokémon GO, y compris X/Y et shiny", () => {
  for (const form of ["mega", "mega-x", "mega-y"]) {
    assert.deepEqual(resolvePreferredPokemonAsset(mega(form)), {
      image: `${form}-go.png`,
      source: "pokemon-go-mega",
      status: "matched",
      reason: null,
    });
    assert.equal(
      resolvePreferredPokemonAsset(mega(form), { shiny: true }).image,
      `${form}-go-shiny.png`,
    );
  }
});

test("une Méga sans Pokémon GO utilise HOME puis le portrait documenté", () => {
  const homeOnly = mega();
  homeOnly.data.assets.image = null;
  assert.equal(resolvePreferredPokemonAsset(homeOnly).source, "home-mega");
  homeOnly.data.assets.home.image = null;
  assert.equal(resolvePreferredPokemonAsset(homeOnly).source, "mega-fallback");
});

test("les URL dangereuses sont ignorées et le placeholder reste le dernier recours", () => {
  const invalid = mega();
  invalid.data.assets.image = "javascript:alert(1)";
  invalid.data.assets.home.image = "https://";
  invalid.data.assets.portrait = "ftp://invalid.example/mega.png";
  assert.deepEqual(resolvePreferredPokemonAsset(invalid), {
    image: null,
    source: "missing",
    status: "missing-asset",
    reason: "POKEMON_ASSET_NOT_FOUND",
  });
  assert.equal(usableImage("data:text/html,test"), null);
});
