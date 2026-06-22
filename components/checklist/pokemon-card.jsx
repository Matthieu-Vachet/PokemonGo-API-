import { catalogItem, pokemonVariantLabel, preferredPokemonImage, typeBackground, typeColors, typeIcon, typeName } from "../site/pokemon-style";
import { uiAssets } from "../site/ui-assets";

function hasAssets(entry) {
  const assets = entry.assets || {};
  return Boolean(
    assets.go ||
      assets.candy ||
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
  return (
    <span
      className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-black text-white shadow-sm"
      style={{
        background: `color-mix(in srgb, ${typeColors[type] || "#7aa7ff"} 58%, rgba(255,255,255,.12))`,
      }}
    >
      {typeIcon(type, catalog) ? (
        <img className="h-5 w-5 shrink-0 object-contain" src={typeIcon(type, catalog)} alt="" />
      ) : (
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: typeColors[type] || "#7aa7ff" }}
        />
      )}
      <span className="truncate">{typeName(type, catalog)}</span>
    </span>
  );
}

function WeatherBadge({ weatherId, catalog }) {
  const item = catalogItem(catalog, weatherId);
  return (
    <span className="inline-flex min-h-8 min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-black text-slate-100">
      {item?.assets?.icon ? (
        <img className="h-5 w-5 shrink-0 object-contain" src={item.assets.icon} alt="" />
      ) : null}
      <span className="truncate">{item?.names?.French || weatherId}</span>
    </span>
  );
}

function MiniInfo({ children, icon }) {
  return (
    <span className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-black text-slate-200">
      {icon ? <img className="h-4 w-4 shrink-0 object-contain" src={icon} alt="" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function PokemonCard({
  entry,
  onOpen,
  actionLabel = "Voir la fiche",
  typeCatalog = [],
  weatherCatalog = [],
}) {
  const types = [entry.primaryType, entry.secondaryType].filter(Boolean);
  const weather = (entry.weatherBoost || []).filter(Boolean);
  const assetsPresent = hasAssets(entry);
  const mainType = entry.primaryType || "NORMAL";
  const background = typeBackground(mainType, typeCatalog);
  const candyIcon = entry.assets?.candy?.image;
  const displayImage = preferredPokemonImage(entry);
  const variantLabel = pokemonVariantLabel(entry);

  return (
    <article
      className="relative isolate min-h-[292px] overflow-hidden rounded-[1.65rem] border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition"
      style={{
        borderColor: `color-mix(in srgb, ${typeColors[mainType] || "#7aa7ff"} 58%, rgba(255,255,255,.22))`,
        backgroundImage: `${
          background ? `linear-gradient(120deg, rgba(255,255,255,.16), rgba(2,6,23,.34)), url("${background}")` : "linear-gradient(120deg, rgba(30,64,175,.42), rgba(5,150,105,.32))"
        }`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,255,255,.22),transparent_38%),radial-gradient(circle_at_18%_0%,rgba(255,255,255,.28),transparent_30%),linear-gradient(to_bottom,rgba(2,6,23,.18),rgba(2,6,23,.42))]" />
      <div
        className="absolute inset-x-[-20%] bottom-[-38%] -z-10 h-2/3 rounded-full blur-3xl"
        style={{ background: `color-mix(in srgb, ${typeColors[mainType] || "#7aa7ff"} 58%, transparent)` }}
      />
      <div className="grid grid-cols-[86px_minmax(0,1fr)_58px] items-center gap-3 max-[520px]:grid-cols-[74px_minmax(0,1fr)]">
        <div className="grid h-[86px] w-[86px] place-items-center overflow-hidden rounded-full border-[5px] border-white/85 bg-[linear-gradient(#fff_0_48%,#1f2937_49%_52%,#ff4f5e_53%_100%)] shadow-[0_16px_42px_rgba(255,255,255,.16)] max-[520px]:h-[74px] max-[520px]:w-[74px]">
          {displayImage ? (
            <img className="h-[105%] w-[105%] object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,.38)]" src={displayImage} alt={entry.name} />
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
          <span className="mt-2 inline-flex rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white">
            {variantLabel}
          </span>
        </div>
        <div className="grid h-[58px] w-[58px] place-items-center rounded-full border border-white/15 bg-slate-950/50 p-2 text-sm font-black text-white shadow-[0_12px_34px_rgba(0,0,0,.24)] max-[520px]:absolute max-[520px]:right-4 max-[520px]:top-4 max-[520px]:h-[54px] max-[520px]:w-[54px]">
          <img
            className="max-h-full object-contain drop-shadow-[0_0_14px_rgba(255,255,255,.25)]"
            src={candyIcon || uiAssets.icons.pokeball}
            alt=""
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 min-[521px]:grid-cols-2">
        {types.map((type) => (
          <TypeBadge key={type} type={type} catalog={typeCatalog} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
        {weather.slice(0, 2).map((weatherId) => (
          <WeatherBadge key={weatherId} weatherId={weatherId} catalog={weatherCatalog} />
        ))}
        <MiniInfo icon={uiAssets.icons.attack}>
          {entry.quickMoveCount || 0} rapide(s)
        </MiniInfo>
        <MiniInfo icon={uiAssets.icons.attack}>
          {entry.chargedMoveCount || 0} chargée(s)
        </MiniInfo>
        {entry.maxMoveCount ? (
          <MiniInfo icon={uiAssets.icons.attack}>
            {entry.maxMoveCount} Max
          </MiniInfo>
        ) : null}
        <span
          className="inline-flex min-h-8 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 text-xs font-black text-cyan-100"
        >
          Données publiques
        </span>
        <span
          className={`inline-flex min-h-8 items-center justify-center rounded-lg border px-3 text-xs font-black ${
            assetsPresent
              ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
              : "border-sky-300/30 bg-sky-300/10 text-sky-100"
          }`}
        >
          {assetsPresent ? "Assets disponibles" : "Images à venir"}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {onOpen ? (
          <button
            className="min-h-12 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-emerald-400 px-4 font-black text-white shadow-[0_16px_45px_rgba(14,165,233,.25)] transition hover:scale-[1.01]"
            type="button"
            onClick={() => onOpen(entry)}
          >
            {actionLabel}
          </button>
        ) : (
          <span className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/25 bg-white/16 px-4 text-sm font-black text-white shadow-[0_14px_34px_rgba(0,0,0,.18)]">
            Explorer la fiche
          </span>
        )}
      </div>
    </article>
  );
}
