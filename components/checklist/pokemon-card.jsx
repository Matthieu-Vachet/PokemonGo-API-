const typeLabels = {
  BUG: "Insecte",
  DARK: "Ténèbres",
  DRAGON: "Dragon",
  ELECTRIC: "Électrik",
  FAIRY: "Fée",
  FIGHTING: "Combat",
  FIRE: "Feu",
  FLYING: "Vol",
  GHOST: "Spectre",
  GRASS: "Plante",
  GROUND: "Sol",
  ICE: "Glace",
  NORMAL: "Normal",
  POISON: "Poison",
  PSYCHIC: "Psy",
  ROCK: "Roche",
  STEEL: "Acier",
  WATER: "Eau",
};

const typeColors = {
  BUG: "#91c12f",
  DARK: "#5a5465",
  DRAGON: "#0b6dc3",
  ELECTRIC: "#f4d23c",
  FAIRY: "#ec8fe6",
  FIGHTING: "#ce416b",
  FIRE: "#ff9d55",
  FLYING: "#89aae3",
  GHOST: "#5269ad",
  GRASS: "#63bc5a",
  GROUND: "#d97845",
  ICE: "#73cec0",
  NORMAL: "#919aa2",
  POISON: "#aa6bc8",
  PSYCHIC: "#fa7179",
  ROCK: "#c5b78c",
  STEEL: "#5a8ea2",
  WATER: "#5090d6",
};

function catalogItem(items, id) {
  return (items || []).find((item) => item.id === id || item.type === id);
}

function hasAssets(entry) {
  const assets = entry.assets || {};
  return Boolean(
    assets.go ||
      assets.goShiny ||
      assets.home ||
      assets.homeShiny ||
      assets.goVariants ||
      assets.homeVariants ||
      assets.locationCards ||
      assets.shuffleVariants,
  );
}

function TypeBadge({ type, catalog }) {
  if (!type) return null;
  const item = catalogItem(catalog, type);
  return (
    <span
      className="inline-flex min-h-8 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-black text-white shadow-sm"
      style={{
        background: `color-mix(in srgb, ${typeColors[type] || "#7aa7ff"} 58%, rgba(255,255,255,.12))`,
      }}
    >
      {item?.assets?.icon ? (
        <img className="h-5 w-5 object-contain" src={item.assets.icon} alt="" />
      ) : (
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: typeColors[type] || "#7aa7ff" }}
        />
      )}
      {item?.names?.French || typeLabels[type] || type}
    </span>
  );
}

function WeatherBadge({ weatherId, catalog }) {
  const item = catalogItem(catalog, weatherId);
  return (
    <span className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-black text-slate-100">
      {item?.assets?.icon ? (
        <img className="h-5 w-5 object-contain" src={item.assets.icon} alt="" />
      ) : null}
      {item?.names?.French || weatherId}
    </span>
  );
}

export function PokemonCard({
  entry,
  onOpen,
  actionLabel = "Voir la fiche",
  compact = false,
  admin = false,
  assetChecked = false,
  onAssetChecked,
  typeCatalog = [],
  weatherCatalog = [],
}) {
  const score = entry?.quality?.score ?? 0;
  const types = [entry.primaryType, entry.secondaryType].filter(Boolean);
  const weather = (entry.weatherBoost || []).filter(Boolean);
  const assetsPresent = hasAssets(entry);
  const mainType = entry.primaryType || "NORMAL";
  const mainTypeData = catalogItem(typeCatalog, mainType);

  return (
    <article
      className={`relative isolate min-h-[292px] overflow-hidden rounded-lg border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] ${
        entry.complete ? "border-emerald-300/25" : "border-amber-300/30"
      } ${assetChecked ? "ring-2 ring-emerald-300/50" : ""}`}
      style={{
        borderColor: `color-mix(in srgb, ${typeColors[mainType] || "#7aa7ff"} 42%, rgba(255,255,255,.12))`,
        backgroundImage: `${
          mainTypeData?.assets?.background ? `linear-gradient(120deg, rgba(8,10,13,.88), rgba(24,28,36,.76)), url("${mainTypeData.assets.background}")` : "linear-gradient(120deg, rgba(8,10,13,.92), rgba(24,28,36,.84))"
        }`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        className="absolute inset-x-[-20%] bottom-[-38%] -z-10 h-2/3 rounded-full blur-3xl"
        style={{ background: `color-mix(in srgb, ${typeColors[mainType] || "#7aa7ff"} 45%, transparent)` }}
      />
      <div className="grid grid-cols-[86px_minmax(0,1fr)_58px] items-center gap-3 max-[420px]:grid-cols-[74px_minmax(0,1fr)_50px]">
        <div className="grid h-[86px] w-[86px] place-items-center overflow-hidden rounded-full border-[5px] border-white/75 bg-[linear-gradient(#fff_0_48%,#1f2937_49%_52%,#ff4f5e_53%_100%)] max-[420px]:h-[74px] max-[420px]:w-[74px]">
          {entry.image ? (
            <img className="h-[82%] w-[82%] object-contain drop-shadow-lg" src={entry.image} alt={entry.name} />
          ) : (
            <span className="h-6 w-6 rounded-full bg-slate-900" />
          )}
        </div>
        <div className="min-w-0">
          <span className="font-black tracking-widest text-slate-200">N° {entry.dexId}</span>
          <h3 className="mt-1 break-words text-xl font-black leading-tight text-white">
            {entry.name}
          </h3>
          <p className="mt-1 truncate text-sm font-medium text-slate-300">
            {entry.profile || entry.kind} · {entry.form || "normal"} · Gén.{" "}
            {entry.generation || "?"}
          </p>
        </div>
        <div
          className="grid h-[58px] w-[58px] place-items-center rounded-full text-sm font-black text-white max-[420px]:h-[50px] max-[420px]:w-[50px]"
          style={{
            background: `radial-gradient(circle at center, #08090d 54%, transparent 56%), conic-gradient(${typeColors[mainType] || "#7aa7ff"} ${score}%, rgba(255,255,255,.16) 0)`,
          }}
        >
          {score}%
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {types.map((type) => (
          <TypeBadge key={type} type={type} catalog={typeCatalog} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
        {weather.slice(0, 2).map((weatherId) => (
          <WeatherBadge key={weatherId} weatherId={weatherId} catalog={weatherCatalog} />
        ))}
        <span className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-black text-slate-200">
          {entry.quickMoveCount || 0} rapide(s)
        </span>
        <span className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-black text-slate-200">
          {entry.chargedMoveCount || 0} chargée(s)
        </span>
        {entry.maxMoveCount ? (
          <span className="inline-flex min-h-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-black text-slate-200">
            {entry.maxMoveCount} Max
          </span>
        ) : null}
        <span
          className={`inline-flex min-h-8 items-center justify-center rounded-lg border px-3 text-xs font-black ${
            entry.complete
              ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
              : "border-amber-300/30 bg-amber-300/10 text-amber-200"
          }`}
        >
          {entry.complete ? "JSON complet" : `${entry.issues.length} problème(s)`}
        </span>
        <span
          className={`inline-flex min-h-8 items-center justify-center rounded-lg border px-3 text-xs font-black ${
            assetsPresent
              ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
              : "border-amber-300/30 bg-amber-300/10 text-amber-200"
          }`}
        >
          {assetsPresent ? "Assets liés" : "Assets à vérifier"}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {admin ? (
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-black text-white">
            <input
              className="h-5 w-5 accent-emerald-400"
              type="checkbox"
              checked={assetChecked}
              onChange={(event) => onAssetChecked?.(entry.key, event.target.checked)}
            />
            <span>Assets OK</span>
          </label>
        ) : null}
        {onOpen ? (
          <button
            className="min-h-11 rounded-lg bg-gradient-to-r from-rose-500 to-amber-300 px-4 font-black text-zinc-950"
            type="button"
            onClick={() => onOpen(entry)}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}
