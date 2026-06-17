import { PokemonCard } from "./pokemon-card";

const entry = {
  key: "pokemon:data/pokemon/0001-bulbasaur.json",
  name: "Bulbizarre",
  dexId: "0001",
  form: "normal",
  kind: "pokemon",
  generation: 1,
  primaryType: "GRASS",
  secondaryType: "POISON",
  quickMoveCount: 2,
  chargedMoveCount: 3,
  issues: [{ path: "description", issue: "missing" }],
  quality: { score: 87 },
  image:
    "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/Pokemon/pm1.icon.png",
};

export default {
  title: "Checklist/PokemonCard",
  component: PokemonCard,
  tags: ["autodocs"],
};

export const Default = {
  args: {
    entry,
  },
};
