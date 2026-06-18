"use client";

import { useEffect, useMemo, useState } from "react";
import { typeColors, typeIcon, typeName } from "../site/pokemon-style";
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

function Section({ title, eyebrow, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_20px_70px_rgba(0,0,0,.22)] sm:p-5">
      {eyebrow ? (
        <p className="mb-1 text-xs font-black uppercase tracking-[0.24em] text-cyan-200/70">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mb-4 text-lg font-black tracking-tight text-white sm:text-xl">{title}</h3>
      {children}
    </section>
  );
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
    <Section title="Noms traduits" eyebrow="localisation">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {entries.map(([language, value]) => (
          <div className="grid grid-cols-[2.2rem_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3" key={language}>
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-xs font-black text-cyan-100">
              {language.slice(0, 2).toUpperCase()}
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

function MoveList({ title, moves, typeCatalog = [] }) {
  const list = moveArray(moves).filter(Boolean).map((move) =>
    typeof move === "string" ? { id: move } : move,
  );
  return (
    <Section title={title}>
      {list.length ? (
        <div className="grid gap-3">
          {list.map((move) => (
            <div
              className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm"
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
                  ["Buffs", move.combat?.buffs ? JSON.stringify(move.combat.buffs) : "-"],
                ].map(([label, value]) => (
                  <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2" key={label}>
                    <small className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</small>
                    <strong className="mt-1 block break-words text-white">{valueOrDash(value)}</strong>
                  </span>
                ))}
              </div>
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
    <Section title="Galerie liée à la fiche">
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

function IssuesPanel({ entry }) {
  return (
    <Section title="Contrôles de fiche">
      {(entry.issues || []).length ? (
        <div className="space-y-3">
          {entry.issues.map((issue) => (
            <div
              className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4"
              key={`${issue.path}-${issue.issue}`}
            >
              <strong className="block break-words font-mono text-sm text-amber-100">
                {issue.path}
              </strong>
              <span className="mt-1 block text-sm font-bold text-amber-200/80">
                {issue.issue} · attendu {issue.expected} · actuel {issue.actual}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyInline>Aucun problème détecté.</EmptyInline>
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
  const leagues = Object.entries(labels);
  return (
    <Section title="Ligues PvP">
      <div className="grid gap-3 lg:grid-cols-2">
        {leagues.map(([key, label]) => {
          const value = pvp?.[key];
          if (!value) {
            return (
              <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={key}>
                <strong className="block font-black text-white">{label}</strong>
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
                <strong className="text-lg font-black text-white">{label}</strong>
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

function AdminActions({ entry, onCopyPatch, onAuditUrls, onAssetAudit, extraPanel }) {
  return (
    <Section title="Outils admin" eyebrow="privé">
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-cyan-200/50 hover:bg-cyan-400/15"
          type="button"
          onClick={() => onCopyPatch?.(entry)}
        >
          Copier le brouillon JSON
        </button>
        <button
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-cyan-200/50 hover:bg-cyan-400/15"
          type="button"
          onClick={() => onAuditUrls?.(entry)}
        >
          Vérifier les URLs
        </button>
        <button
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-cyan-200/50 hover:bg-cyan-400/15"
          type="button"
          onClick={() => onAssetAudit?.(entry)}
        >
          Audit assets
        </button>
      </div>
      {extraPanel ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-200">
          {extraPanel}
        </div>
      ) : null}
    </Section>
  );
}

export function DetailModal({
  open,
  entry,
  detail,
  mode = "public",
  onClose,
  onCopyPatch,
  onAuditUrls,
  onAssetAudit,
  extraPanel,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-md sm:items-center sm:p-6" role="presentation" onClick={onClose}>
      <div
        className="max-h-[96dvh] w-full max-w-6xl overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#08111f] text-white shadow-[0_30px_120px_rgba(0,0,0,.65)] sm:max-h-[92dvh] sm:rounded-[2rem]"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_8%_0%,rgba(168,85,247,.44),transparent_36%),radial-gradient(circle_at_92%_15%,rgba(45,212,191,.36),transparent_34%),linear-gradient(135deg,rgba(59,130,246,.25),rgba(15,23,42,.86))] px-4 py-5 sm:px-6 sm:py-6">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="relative flex items-center gap-4 pr-14">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-white/80 bg-white shadow-[0_18px_60px_rgba(0,0,0,.32)] sm:h-28 sm:w-28">
              {entry.image ? (
                <img className="max-h-20 object-contain sm:max-h-24" src={entry.image} alt={entry.name} />
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

        <div className="max-h-[calc(96dvh-150px)] overflow-auto p-4 sm:max-h-[calc(92dvh-165px)] sm:p-6">
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
                {mode === "admin" ? (
                  <AdminActions
                    entry={entry}
                    onCopyPatch={onCopyPatch}
                    onAuditUrls={onAuditUrls}
                    onAssetAudit={onAssetAudit}
                    extraPanel={extraPanel}
                  />
                ) : null}
                <TranslationGrid names={names} />
                <Section title="Identifiants">
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
                <Section title="Identité et capture">
                  <DataGrid
                    items={[
                      { label: "Types", value: [entry.primaryType, entry.secondaryType].filter(Boolean).map((type) => typeName(type, typeCatalog)).join(" / ") || "-", icon: uiAssets.icons.tag },
                      { label: "Boost météo", value: weatherNames.join(", ") || "-", icon: uiAssets.icons.speedometer },
                      { label: "Taille", value: valueOrDash(size.height, " m"), icon: uiAssets.icons.height },
                      { label: "Poids", value: valueOrDash(size.weight, " kg"), icon: uiAssets.icons.weight },
                      { label: "Distance buddy", value: valueOrDash(payload.buddyDistance, " km"), icon: uiAssets.icons.pokemon },
                      { label: "Taux capture", value: valueOrDash(payload.catchRate, "%"), icon: uiAssets.icons.pokedex },
                      { label: "Taux fuite", value: valueOrDash(payload.fleeRate, "%"), icon: uiAssets.icons.speedometer },
                      { label: "Énergie méga", value: valueOrDash(payload.megaEnergyReward), icon: uiAssets.icons.mega },
                      { label: "Coût méga", value: valueOrDash(payload.energyCost), icon: uiAssets.icons.mega },
                      { label: "Récompenses", value: `${valueOrDash(captureRewards.candy)} bonbons / ${valueOrDash(captureRewards.stardust)} poussières`, icon: uiAssets.icons.tag },
                      { label: "2e attaque", value: `${valueOrDash(secondMove.candy)} bonbons / ${valueOrDash(secondMove.stardust)} poussières`, icon: uiAssets.icons.combat },
                    ]}
                  />
                </Section>
                <Section title="Disponibilité">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(availability).map(([key, value]) => (
                      <span
                        className={`rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                          value
                            ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-100"
                            : "border-white/10 bg-white/[0.045] text-slate-400"
                        }`}
                        key={key}
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </Section>
              </>
            ) : null}

            {activeTab === "cp" ? (
              <>
                <Section title="Statistiques">
                  <DataGrid
                    items={[
                      { label: "Attaque", value: valueOrDash(stats.attack), icon: uiAssets.icons.combat },
                      { label: "Défense", value: valueOrDash(stats.defense), icon: uiAssets.icons.shield || uiAssets.icons.pokedex },
                      { label: "Endurance", value: valueOrDash(stats.stamina), icon: uiAssets.icons.speedometer },
                      { label: "PC 50", value: valueOrDash(maxCp.maxLevel50), icon: uiAssets.icons.mega },
                      { label: "PC 40", value: valueOrDash(maxCp.maxLevel40), icon: uiAssets.icons.mega },
                      { label: "Raid 20", value: valueOrDash(maxCp.raidLevel20), icon: uiAssets.icons.raid },
                      { label: "Météo 25", value: valueOrDash(maxCp.weatherBoostLevel25), icon: uiAssets.icons.speedometer },
                      { label: "Recherche 15", value: valueOrDash(maxCp.researchLevel15), icon: uiAssets.icons.search },
                    ]}
                  />
                </Section>
                <Section title="PC par niveau">
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
                <MoveList title="Attaques rapides" moves={moveCollection(moveDetails, "quickMoves", payload.quickMoves)} typeCatalog={typeCatalog} />
                <MoveList title="Attaques chargées" moves={moveCollection(moveDetails, "cinematicMoves", payload.cinematicMoves)} typeCatalog={typeCatalog} />
                <MoveList title="Attaques elite rapides" moves={moveCollection(moveDetails, "eliteQuickMoves", payload.eliteQuickMoves)} typeCatalog={typeCatalog} />
                <MoveList title="Attaques elite chargées" moves={moveCollection(moveDetails, "eliteCinematicMoves", payload.eliteCinematicMoves)} typeCatalog={typeCatalog} />
                <MoveList title="Attaques Max / GMax" moves={moveCollection(moveDetails, "maxMoves", payload.maxBattle?.moves)} typeCatalog={typeCatalog} />
              </>
            ) : null}

            {activeTab === "pvp" ? (
              <PvpPanel pvp={pvp} moveDetails={moveDetails} />
            ) : null}

            {activeTab === "shadow" ? (
              <Section title="Shadow / Purification">
                <DataGrid
                  items={[
                    { label: "Shadow", value: availability.shadow ? "Oui" : "Non", icon: uiAssets.icons.shadow },
                    { label: "Purification", value: valueOrDash(payload.shadow?.purificationCost?.stardust, " poussières"), icon: uiAssets.icons.purified },
                    { label: "Bonbons", value: valueOrDash(payload.shadow?.purificationCost?.candy), icon: uiAssets.icons.tag },
                    { label: "Sortie", value: formatDate(payload.shadow?.firstReleaseDate || payload.shadow?.releaseDate), icon: uiAssets.icons.radar },
                    { label: "Catch CP normal", value: formatRange(payload.shadow?.catchCp?.normal), icon: uiAssets.icons.pokedex },
                    { label: "Catch CP météo", value: formatRange(payload.shadow?.catchCp?.weatherBoosted), icon: uiAssets.icons.speedometer },
                  ]}
                />
              </Section>
            ) : null}

            {activeTab === "assets" ? <AssetGallery entry={entry} payload={payload} /> : null}
            {activeTab === "json" ? (
              <div className="space-y-4">
                <IssuesPanel entry={entry} />
                <Section title="JSON source">
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
