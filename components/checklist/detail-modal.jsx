"use client";

import { useEffect, useMemo, useState } from "react";
import { typeBackground, typeColors, typeIcon, typeName } from "../site/pokemon-style";
import { uiAssets } from "../site/ui-assets";

const tabLabels = {
  overview: "Aperçu",
  cp: "PC & stats",
  moves: "Attaques",
  pvp: "PvP",
  shadow: "Shadow",
  assets: "Assets",
  json: "JSON",
};

function valueOrDash(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return `${value}${suffix}`;
}

function Section({ title, eyebrow, icon, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.075] p-4 shadow-[0_20px_70px_rgba(0,0,0,.2)] backdrop-blur sm:p-5">
      {eyebrow ? (
        <p className="mb-1 text-xs font-black uppercase tracking-[0.24em] text-cyan-200/70">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mb-4 flex items-center gap-3 text-lg font-black tracking-tight text-white sm:text-xl">
        {icon ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/35 p-2">
            <img className="max-h-full object-contain" src={icon} alt="" />
          </span>
        ) : null}
        <span>{title}</span>
      </h3>
      {children}
    </section>
  );
}

function typePanelBackground(type, typeCatalog = []) {
  const background = typeBackground(type, typeCatalog);
  return background
    ? `linear-gradient(135deg, rgba(2,6,23,.68), rgba(8,13,25,.52)), url("${background}")`
    : "linear-gradient(135deg, rgba(15,23,42,.7), rgba(2,6,23,.58))";
}

function DataGrid({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="grid grid-cols-[2.45rem_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-left"
          key={item.label}
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]">
            {item.icon ? (
              <img className="h-6 w-6 object-contain" src={item.icon} alt="" />
            ) : (
              <span className="h-3 w-3 rounded-full bg-cyan-300" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {item.label}
            </span>
            <strong className="mt-2 block break-words text-base font-black text-white">
              {item.value}
            </strong>
          </span>
        </div>
      ))}
    </div>
  );
}

const languageLabels = {
  English: "Anglais",
  German: "Allemand",
  French: "Français",
  Italian: "Italien",
  Japanese: "Japonais",
  Korean: "Coréen",
  Spanish: "Espagnol",
};

function TranslationGrid({ names = {} }) {
  const entries = Object.entries(names || {}).filter(([, value]) => value);
  if (!entries.length) return null;
  return (
    <Section title="Noms traduits" eyebrow="localisation" icon={uiAssets.icons.pokeball}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {entries.map(([language, value]) => (
          <div className="grid grid-cols-[2.2rem_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3" key={language}>
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] p-1.5 text-xs font-black text-cyan-100">
              <img className="max-h-full object-contain" src={uiAssets.icons.pokeball} alt="" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {languageLabels[language] || language}
              </span>
              <strong className="mt-1 block break-words text-white">{value}</strong>
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function EmptyInline({ children }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-4 text-sm font-bold text-slate-300">
      {children}
    </p>
  );
}

function CandyAmount({ value, icon, label = "bonbons" }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 align-middle">
      {icon ? <img className="h-5 w-5 shrink-0 object-contain" src={icon} alt="" /> : null}
      <span>{valueOrDash(value)} {label}</span>
    </span>
  );
}

function RewardValue({ candy, stardust, candyIcon }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <CandyAmount value={candy} icon={candyIcon} />
      <span className="inline-flex items-center gap-2">
        <img className="h-5 w-5 shrink-0 object-contain" src={uiAssets.icons.stardust} alt="" />
        <span>{valueOrDash(stardust)} poussières</span>
      </span>
    </span>
  );
}

function moveArray(moves) {
  if (!moves) return [];
  if (Array.isArray(moves)) return moves;
  if (typeof moves === "object") return Object.values(moves);
  return [];
}

function moveCollection(details, key, fallback) {
  const detailed = details?.[key];
  const detailedList = moveArray(detailed).filter(Boolean);
  return detailedList.length ? detailed : fallback;
}

function moveName(move, allMoves = {}) {
  if (!move) return "-";
  if (typeof move === "string") {
    const found = Object.values(allMoves)
      .flatMap(moveArray)
      .find((item) => item.id === move);
    return found?.names?.French || found?.names?.English || move;
  }
  return move.names?.French || move.names?.English || move.id || "-";
}

function formatRange(range) {
  if (!range || typeof range !== "object") return "-";
  if (range.min === undefined && range.max === undefined) return "-";
  return `${range.min ?? "?"} - ${range.max ?? "?"}`;
}

function formatDate(value) {
  if (!value) return "-";
  return String(value);
}

function MoveTypePill({ type, typeCatalog }) {
  if (!type) return null;
  return (
    <span
      className="inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-black text-white"
      style={{ background: `color-mix(in srgb, ${typeColors[type] || "#64748b"} 55%, rgba(255,255,255,.12))` }}
    >
      {typeIcon(type, typeCatalog) ? (
        <img className="h-4 w-4 shrink-0 object-contain" src={typeIcon(type, typeCatalog)} alt="" />
      ) : null}
      <span className="truncate">{typeName(type, typeCatalog)}</span>
    </span>
  );
}

function formatBuffValue(value) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number" && value > 0) return `+${value}`;
  return String(value);
}

function BuffGrid({ buffs }) {
  if (!buffs || typeof buffs !== "object") return null;
  const rows = [
    ["Chance", buffs.activationChance !== undefined ? `${buffs.activationChance}%` : "-"],
    ["Attaque lanceur", formatBuffValue(buffs.attackerAttackStatsChange)],
    ["Défense lanceur", formatBuffValue(buffs.attackerDefenseStatsChange)],
    ["Attaque cible", formatBuffValue(buffs.targetAttackStatsChange)],
    ["Défense cible", formatBuffValue(buffs.targetDefenseStatsChange)],
  ];
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {rows.map(([label, value]) => (
        <span className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2" key={label}>
          <small className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</small>
          <strong className="mt-1 block text-white">{value}</strong>
        </span>
      ))}
    </div>
  );
}

const availabilityLabels = {
  released: "Sorti",
  shinyReleased: "Shiny",
  tradable: "Échange",
  pokemonHomeTransfer: "Home",
  shadow: "Shadow",
  dynamax: "Dyna",
  gigantamax: "GMax",
  apex: "Apex",
};

function MoveList({ title, moves, typeCatalog = [], icon }) {
  const list = moveArray(moves).filter(Boolean).map((move) =>
    typeof move === "string" ? { id: move } : move,
  );
  return (
    <Section title={title} icon={icon}>
      {list.length ? (
        <div className="grid gap-3">
          {list.map((move) => (
            <div
              className="overflow-hidden rounded-2xl border border-white/10 bg-cover bg-center p-4 text-sm"
              style={{ backgroundImage: typePanelBackground(move.type, typeCatalog) }}
              key={move.id || move.slug || moveName(move)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="min-w-0">
                  <strong className="block break-words font-black text-white">
                    {moveName(move)}
                  </strong>
                  <small className="mt-1 block font-mono text-xs text-slate-500">{move.id}</small>
                </span>
                <MoveTypePill type={move.type} typeCatalog={typeCatalog} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Puissance", move.power],
                  ["Énergie", move.energy ?? move.combat?.energy],
                  ["Durée", move.durationMs ? `${move.durationMs} ms` : undefined],
                  ["Tours PvP", move.combat?.turns],
                  ["Puissance PvP", move.combat?.power],
                ].map(([label, value]) => (
                  <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2" key={label}>
                    <small className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</small>
                    <strong className="mt-1 block break-words text-white">{valueOrDash(value)}</strong>
                  </span>
                ))}
              </div>
              <BuffGrid buffs={move.combat?.buffs} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyInline>Aucune attaque renseignée.</EmptyInline>
      )}
    </Section>
  );
}

function AssetGallery({ entry, payload }) {
  const [preview, setPreview] = useState(null);
  const assets = [];
  const add = (group, label, url, meta = "") => {
    if (url) assets.push({ group, label, url, meta });
  };

  add("Pokémon GO", "Image principale", payload.assets?.image || entry.image);
  add("Pokémon GO", "Image shiny", payload.assets?.shinyImage || entry.shinyImage, "shiny");
  add("Portraits", "Portrait", payload.assets?.portrait, "méga / primo");
  add("Pokémon Home", "Home", payload.assets?.home?.image);
  add("Pokémon Home", "Home shiny", payload.assets?.home?.shinyImage, "shiny");

  for (const [index, asset] of (payload.assetForms || []).entries()) {
    add("Variantes GO", `Variante ${index + 1}`, asset.image, asset.form || asset.costume || "");
    add("Variantes GO", `Variante shiny ${index + 1}`, asset.shinyImage, "shiny");
  }
  for (const [index, asset] of (payload.assets?.home?.variants || []).entries()) {
    add("Variantes Home", `Home ${index + 1}`, asset.image || asset.shinyImage, asset.detail || asset.view || "");
  }
  for (const [index, asset] of (payload.assets?.shuffle?.variants || []).entries()) {
    add("Pokémon Shuffle", `Shuffle ${index + 1}`, asset.image, asset.tags?.join(" · ") || asset.state || "");
  }
  for (const [index, asset] of (payload.assets?.locationCards || []).entries()) {
    add("Backgrounds", `Background ${index + 1}`, asset.image, asset.name || asset.date || "");
  }
  const groups = [...assets.reduce((map, asset) => {
    if (!map.has(asset.group)) map.set(asset.group, []);
    map.get(asset.group).push(asset);
    return map;
  }, new Map()).entries()];

  return (
    <Section title="Galerie liée à la fiche" icon={uiAssets.icons.result}>
      {assets.length ? (
        <div className="space-y-5">
          {groups.map(([group, groupAssets]) => (
            <div key={group}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="font-black text-white">{group}</h4>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-slate-300">{groupAssets.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {groupAssets.map((asset, index) => (
                  <button
                    className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45 text-left transition hover:border-cyan-200/40 hover:bg-cyan-400/10"
                    key={`${asset.url}-${index}`}
                    type="button"
                    onClick={() => setPreview(asset)}
                  >
                    <div className="flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_30%_15%,rgba(125,211,252,.2),transparent_38%),rgba(255,255,255,.04)] p-4">
                      <img className="max-h-full object-contain drop-shadow-2xl" src={asset.url} alt={asset.label} />
                    </div>
                    <div className="border-t border-white/10 p-3">
                      <strong className="block truncate text-sm font-black text-white">{asset.label}</strong>
                      <span className="mt-1 block truncate text-xs font-bold text-slate-400">
                        {asset.meta || "standard"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {preview ? (
            <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/86 p-4 backdrop-blur-md" role="presentation" onClick={() => setPreview(null)}>
              <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111f]" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                  <strong className="truncate text-xl font-black text-white">{preview.label}</strong>
                  <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-2xl" type="button" onClick={() => setPreview(null)}>×</button>
                </div>
                <div className="grid max-h-[78dvh] place-items-center overflow-auto p-5">
                  <img className="max-h-[70dvh] object-contain" src={preview.url} alt={preview.label} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyInline>Aucun asset lié à cette fiche.</EmptyInline>
      )}
    </Section>
  );
}

function PvpPanel({ pvp, moveDetails }) {
  const labels = {
    littleCup: "Little Cup",
    greatLeague: "Great League",
    ultraLeague: "Ultra League",
    masterLeague: "Master League",
  };
  const icons = {
    littleCup: uiAssets.icons.littleLeague,
    greatLeague: uiAssets.icons.greatLeague,
    ultraLeague: uiAssets.icons.ultraLeague,
    masterLeague: uiAssets.icons.masterLeague,
  };
  const leagues = Object.entries(labels);
  return (
    <Section title="Ligues PvP" icon={uiAssets.icons.battle}>
      <div className="grid gap-3 lg:grid-cols-2">
        {leagues.map(([key, label]) => {
          const value = pvp?.[key];
          if (!value) {
            return (
              <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={key}>
                <div className="flex items-center gap-3">
                  <img className="h-10 w-10 object-contain" src={icons[key]} alt="" />
                  <strong className="block font-black text-white">{label}</strong>
                </div>
                <span className="mt-2 block text-sm font-bold text-slate-500">Aucune donnée PvP renseignée.</span>
              </article>
            );
          }
          const rank = value.rank1 || {};
          const ivs = rank.ivs || {};
          const moves = value.bestMovesets || {};
          return (
            <article className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4" key={key}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-3">
                  <img className="h-12 w-12 shrink-0 object-contain" src={icons[key]} alt="" />
                  <strong className="text-lg font-black text-white">{label}</strong>
                </span>
                <span className="rounded-full bg-slate-950/45 px-3 py-1 text-xs font-black text-cyan-100">
                  {value.tierRank || "Non classé"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["Niveau", rank.level],
                  ["PC", rank.cp],
                  ["IV", `${ivs.attack ?? "?"}/${ivs.defense ?? "?"}/${ivs.stamina ?? "?"}`],
                ].map(([name, data]) => (
                  <span className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2" key={name}>
                    <small className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{name}</small>
                    <strong className="mt-1 block text-white">{valueOrDash(data)}</strong>
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-3">
                <small className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Meilleur moveset</small>
                <strong className="mt-1 block break-words text-white">
                  {moveName(moves.fast, moveDetails)}
                  {(moves.charged || []).length ? ` + ${(moves.charged || []).map((id) => moveName(id, moveDetails)).join(" / ")}` : ""}
                </strong>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

function JsonBlock({ payload }) {
  return (
    <pre className="max-h-[62dvh] overflow-auto rounded-3xl border border-cyan-300/15 bg-slate-950 p-4 text-xs leading-6 text-cyan-50 shadow-inner sm:text-sm">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

export function DetailModal({
  open,
  entry,
  detail,
  onClose,
  onPrevious,
  onNext,
  typeCatalog = [],
  weatherCatalog = [],
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const payload = detail?.detail || detail || {};
  const tabs = useMemo(
    () =>
      [
        "overview",
        "cp",
        "moves",
        "pvp",
        payload.shadow || entry?.availability?.shadow ? "shadow" : null,
        "assets",
        "json",
      ].filter(Boolean),
    [entry, payload],
  );

  useEffect(() => {
    setActiveTab("overview");
  }, [entry?.key]);

  if (!open || !entry) return null;

  const stats = payload.stats || entry.stats || {};
  const maxCp = payload.maxCp || entry.maxCp || {};
  const size = payload.size || {};
  const availability = payload.availability || entry.availability || {};
  const pvp = payload.pvp || {};
  const moveDetails = payload.moveDetails || {};
  const cpByLevel = payload.cpByLevel || [];
  const captureRewards = payload.captureRewards || {};
  const secondMove = payload.secondChargeMoveCost || {};
  const names = payload.names || payload.sourceData?.names || {};
  const region = payload.region || {};
  const weatherNames = (payload.weatherBoost || entry.weatherBoost || [])
    .map((weatherId) => {
      const item = (weatherCatalog || []).find((weather) => weather.id === weatherId || weather.slug === weatherId);
      return item?.names?.French || weatherId;
    })
    .filter(Boolean);
  const mainType = entry.primaryType || payload.primaryType || "NORMAL";
  const candyIcon =
    payload.assets?.candy?.image ||
    payload.sourceData?.assets?.candy?.image ||
    entry.assets?.candy?.image ||
    null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-md sm:items-center sm:p-6" role="presentation" onClick={onClose}>
      <div
        className="max-h-[96dvh] w-full max-w-6xl overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#0d1a2b] text-white shadow-[0_30px_120px_rgba(0,0,0,.65)] sm:max-h-[92dvh] sm:rounded-[2rem]"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative overflow-hidden border-b border-white/10 bg-cover bg-center px-4 py-5 sm:px-6 sm:py-6"
          style={{
            backgroundImage: `${typePanelBackground(mainType, typeCatalog)}, radial-gradient(circle_at_8%_0%,${typeColors[mainType] || "#38bdf8"}66,transparent_36%), radial-gradient(circle_at_92%_15%,rgba(45,212,191,.32),transparent_34%)`,
          }}
        >
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="relative flex items-center gap-4 pr-14">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-white/80 bg-white shadow-[0_18px_60px_rgba(0,0,0,.32)] sm:h-28 sm:w-28">
              {entry.image ? (
                <img className="max-h-[5.7rem] object-contain sm:max-h-[6.7rem]" src={entry.image} alt={entry.name} />
              ) : (
                <span className="h-10 w-10 rounded-full border-[10px] border-slate-900/20" />
              )}
            </div>
            <div className="min-w-0">
              <span className="font-mono text-sm font-black uppercase tracking-[0.24em] text-cyan-100/80">
                N° {entry.dexId}
              </span>
              <h2 className="mt-1 truncate text-3xl font-black tracking-tight text-white sm:text-5xl">
                {entry.name}
              </h2>
              <p className="mt-2 text-sm font-bold text-slate-200 sm:text-base">
                {entry.profile || entry.kind} · {entry.form || "normal"} · Gén. {entry.generation || "?"}
              </p>
            </div>
            <button
              className="absolute right-0 top-0 grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-white/10 text-3xl font-light text-white transition hover:bg-white/20"
              type="button"
              onClick={onClose}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </div>

        <div
          className="max-h-[calc(96dvh-150px)] overflow-auto p-4 sm:max-h-[calc(92dvh-165px)] sm:p-6"
          style={{
            backgroundImage: `radial-gradient(circle at 8% 0%, ${typeColors[mainType] || "#38bdf8"}2f, transparent 30%), radial-gradient(circle at 92% 10%, rgba(34,211,238,.14), transparent 28%)`,
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <button className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black transition hover:bg-white/10" type="button" onClick={onPrevious}>
              Fiche précédente
            </button>
            <button className="rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-black text-white shadow-[0_14px_45px_rgba(14,165,233,.28)] transition hover:scale-[1.01]" type="button" onClick={onNext}>
              Fiche suivante
            </button>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2 pb-2" aria-label="Onglets de fiche">
            {tabs.map((tab) => (
              <button
                className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                  activeTab === tab
                    ? "border-cyan-200/50 bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-[0_12px_35px_rgba(14,165,233,.25)]"
                    : "border-white/10 bg-white/[0.055] text-slate-200 hover:bg-white/10"
                }`}
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>

          {payload.error ? (
            <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              {payload.error}
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {activeTab === "overview" ? (
              <>
                <TranslationGrid names={names} />
                <Section title="Identifiants" icon={uiAssets.icons.tag}>
                  <DataGrid
                    items={[
                      { label: "ID", value: valueOrDash(payload.id), icon: uiAssets.icons.tag },
                      { label: "Form ID", value: valueOrDash(payload.formId), icon: uiAssets.icons.tag },
                      { label: "Slug", value: valueOrDash(payload.slug), icon: uiAssets.icons.search },
                      { label: "Région", value: region.names?.French || payload.regionId || "-", icon: uiAssets.icons.pokedex },
                      { label: "Génération", value: valueOrDash(payload.generation || entry.generation), icon: uiAssets.icons.pokemon },
                      { label: "Classe", value: valueOrDash(payload.pokemonClass), icon: uiAssets.icons.tag },
                      { label: "Forme", value: valueOrDash(payload.form || entry.form), icon: uiAssets.icons.pokemon },
                      { label: "Fichier", value: valueOrDash(entry.file), icon: uiAssets.icons.copy },
                    ]}
                  />
                </Section>
                <Section title="Identité et capture" icon={uiAssets.icons.pokedexKanto}>
                  <DataGrid
                    items={[
                      { label: "Types", value: [entry.primaryType, entry.secondaryType].filter(Boolean).map((type) => typeName(type, typeCatalog)).join(" / ") || "-", icon: uiAssets.icons.type },
                      { label: "Boost météo", value: weatherNames.join(", ") || "-", icon: uiAssets.icons.weatherBoost },
                      { label: "Taille", value: valueOrDash(size.height, " m"), icon: uiAssets.icons.height },
                      { label: "Poids", value: valueOrDash(size.weight, " kg"), icon: uiAssets.icons.weight },
                      { label: "Distance buddy", value: valueOrDash(payload.buddyDistance, " km"), icon: uiAssets.icons.buddy },
                      { label: "Taux capture", value: valueOrDash(payload.catchRate, "%"), icon: uiAssets.icons.grass },
                      { label: "Taux fuite", value: valueOrDash(payload.fleeRate, "%"), icon: uiAssets.icons.grass },
                      { label: "Énergie méga", value: valueOrDash(payload.megaEnergyReward), icon: uiAssets.icons.megaEnergy },
                      { label: "Coût méga", value: valueOrDash(payload.energyCost), icon: uiAssets.icons.megaEnergy },
                      { label: "Récompenses", value: <RewardValue candy={captureRewards.candy} stardust={captureRewards.stardust} candyIcon={candyIcon} />, icon: candyIcon || uiAssets.icons.candy },
                      { label: "2e attaque", value: <RewardValue candy={secondMove.candy} stardust={secondMove.stardust} candyIcon={candyIcon} />, icon: candyIcon || uiAssets.icons.candy },
                    ]}
                  />
                </Section>
                <Section title="Disponibilité" icon={uiAssets.icons.shiny}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(availability).map(([key, value]) => (
                      <span
                        className={`inline-flex min-h-9 items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-xs font-black ${
                          value
                            ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-100"
                            : "border-white/10 bg-white/[0.045] text-slate-400"
                        }`}
                        key={key}
                      >
                        <span className="truncate">{availabilityLabels[key] || key}</span>
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${value ? "bg-emerald-300" : "bg-slate-600"}`} />
                      </span>
                    ))}
                  </div>
                </Section>
              </>
            ) : null}

            {activeTab === "cp" ? (
              <>
                <Section title="Statistiques de base" icon={uiAssets.icons.swords}>
                  <DataGrid
                    items={[
                      { label: "Attaque", value: valueOrDash(stats.attack), icon: uiAssets.icons.swords },
                      { label: "Défense", value: valueOrDash(stats.defense), icon: uiAssets.icons.shieldAlt },
                      { label: "Endurance", value: valueOrDash(stats.stamina), icon: uiAssets.icons.up },
                    ]}
                  />
                </Section>
                <Section title="PC max et rencontres" icon={uiAssets.icons.maxPc}>
                  <DataGrid
                    items={[
                      { label: "PC 50", value: valueOrDash(maxCp.maxLevel50), icon: uiAssets.icons.maxPc },
                      { label: "PC 40", value: valueOrDash(maxCp.maxLevel40), icon: uiAssets.icons.maxPc },
                      { label: "Raid 20", value: valueOrDash(maxCp.raidLevel20), icon: uiAssets.icons.maxPc },
                      { label: "Météo 25", value: valueOrDash(maxCp.weatherBoostLevel25), icon: uiAssets.icons.maxPc },
                      { label: "Recherche 15", value: valueOrDash(maxCp.researchLevel15), icon: uiAssets.icons.maxPc },
                    ]}
                  />
                </Section>
                <Section title="PC par niveau" icon={uiAssets.icons.maxPc}>
                  {cpByLevel.length ? (
                    <div className="grid max-h-[48dvh] gap-2 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-4">
                      {cpByLevel.map((row) => (
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3" key={row.level}>
                          <span className="font-bold text-slate-300">Niv. {row.level}</span>
                          <strong className="font-black text-white">
                            {row.cp ?? `${row.minCp ?? "?"} - ${row.maxCp ?? "?"} PC`}
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyInline>Pas de table PC calculée.</EmptyInline>
                  )}
                </Section>
              </>
            ) : null}

            {activeTab === "moves" ? (
              <>
                <MoveList title="Attaques rapides" moves={moveCollection(moveDetails, "quickMoves", payload.quickMoves)} typeCatalog={typeCatalog} icon={uiAssets.icons.maxPc} />
                <MoveList title="Attaques chargées" moves={moveCollection(moveDetails, "cinematicMoves", payload.cinematicMoves)} typeCatalog={typeCatalog} icon={uiAssets.icons.attackMove} />
                <MoveList title="Attaques elite rapides" moves={moveCollection(moveDetails, "eliteQuickMoves", payload.eliteQuickMoves)} typeCatalog={typeCatalog} icon={uiAssets.icons.maxPc} />
                <MoveList title="Attaques elite chargées" moves={moveCollection(moveDetails, "eliteCinematicMoves", payload.eliteCinematicMoves)} typeCatalog={typeCatalog} icon={uiAssets.icons.attackMove} />
                <MoveList title="Attaques Max / GMax" moves={moveCollection(moveDetails, "maxMoves", payload.maxBattle?.moves)} typeCatalog={typeCatalog} icon={uiAssets.icons.breadBadge} />
              </>
            ) : null}

            {activeTab === "pvp" ? (
              <PvpPanel pvp={pvp} moveDetails={moveDetails} />
            ) : null}

            {activeTab === "shadow" ? (
              <Section title="Shadow / Purification" icon={uiAssets.icons.shadow}>
                <DataGrid
                  items={[
                    { label: "Shadow", value: availability.shadow ? "Oui" : "Non", icon: uiAssets.icons.shadow },
                    { label: "Purification", value: valueOrDash(payload.shadow?.purificationCost?.stardust, " poussières"), icon: uiAssets.icons.purified },
                    { label: "Bonbons", value: <CandyAmount value={payload.shadow?.purificationCost?.candy} icon={candyIcon} />, icon: candyIcon || uiAssets.icons.candy },
                    { label: "Sortie", value: formatDate(payload.shadow?.firstReleaseDate || payload.shadow?.releaseDate), icon: uiAssets.icons.radar },
                    {
                      label: "Catch CP",
                      value: `Normal ${formatRange(payload.shadow?.catchCp?.normal)} / Météo ${formatRange(payload.shadow?.catchCp?.weatherBoosted)}`,
                      icon: uiAssets.icons.cp,
                    },
                  ]}
                />
              </Section>
            ) : null}

            {activeTab === "assets" ? <AssetGallery entry={entry} payload={payload} /> : null}
            {activeTab === "json" ? (
              <div className="space-y-4">
                <Section title="JSON source" icon={uiAssets.icons.copy}>
                  <JsonBlock payload={payload.sourceData || payload} />
                </Section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
