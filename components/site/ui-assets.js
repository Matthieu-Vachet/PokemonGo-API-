import candyIndex from "../../public/ui/candy/index.json";

const candyDexNumbers = candyIndex
  .map((file) => Number(String(file).replace(".png", "")))
  .filter(Number.isFinite)
  .sort((left, right) => left - right);

export function candyIconForDex(dexId) {
  const dex = Number(String(dexId || "").replace(/^0+/, ""));
  if (!Number.isFinite(dex)) return null;
  let match = null;
  for (const value of candyDexNumbers) {
    if (value > dex) break;
    match = value;
  }
  return match === null ? null : `/ui/candy/${match}.png`;
}

export const uiAssets = {
  logo: "/ui/pokemon-go-logo.png",
  logoWhite: "/ui/pokemon-go-logo-white.png",
  icons: {
    pokedex: "/ui/icons/pokedex.png",
    pokemon: "/ui/icons/pokemon.png",
    search: "/ui/icons/search.png",
    speedometer: "/ui/icons/speedometer.png",
    combat: "/ui/icons/combat.png",
    check: "/ui/icons/check-circle.png",
    tag: "/ui/icons/tag.png",
    weight: "/ui/icons/weight.png",
    height: "/ui/icons/height.png",
    copy: "/ui/icons/copy.png",
    refresh: "/ui/icons/refresh.png",
    shadow: "/ui/icons/shadow.png",
    purified: "/ui/icons/purified.png",
    radar: "/ui/icons/radar.png",
    mega: "/ui/icons/mega-cp.png",
    megaEnergy: "/ui/icons/mega.png",
    raid: "/ui/icons/raid.png",
    type: "/ui/icons/type.image.png",
    weatherBoost: "/ui/icons/boost-meteo.png",
    buddy: "/ui/icons/distance-buddy.png",
    grass: "/ui/icons/grass.png",
    stardust: "/ui/icons/stardus.png",
    attack: "/ui/icons/attaque.png",
    candy: "/ui/icons/bonbon.png",
    littleLeague: "/ui/icons/little.png",
    greatLeague: "/ui/icons/great.png",
    ultraLeague: "/ui/icons/ultra.png",
    masterLeague: "/ui/icons/master.png",
    cp: "/ui/icons/combat.png",
  },
  backgrounds: {
    battle: "/ui/backgrounds/battle-league.png",
    park: "/ui/backgrounds/park.png",
    alola: "/ui/backgrounds/alola.png",
    blue: "/ui/backgrounds/blue-gradient.png",
    mega: "/ui/backgrounds/mega-hero.png",
  },
  regions: {
    kanto: "/ui/regions/kanto.png",
    alola: "/ui/regions/alola.png",
    hisui: "/ui/regions/hisui.png",
    galar: "/ui/regions/galar.png",
    paldea: "/ui/regions/paldea.png",
  },
  generations: {
    1: "/ui/PokedexV2/kanto_starters.png",
    2: "/ui/PokedexV2/jhoto_starters.png",
    3: "/ui/PokedexV2/hoenn_starters.png",
    4: "/ui/PokedexV2/sinnoh_starters.png",
    5: "/ui/PokedexV2/unova_starters.png",
    6: "/ui/PokedexV2/kalos_starters.png",
    7: "/ui/PokedexV2/alola_starters.png",
    8: "/ui/PokedexV2/galar_starters.png",
    9: "/ui/PokedexV2/paldea_starters.png",
  },
};
