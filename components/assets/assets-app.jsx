"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { MetricCard } from "../site/metric-card";
import { uiAssets } from "../site/ui-assets";
import { typeColors, typeIcon, typeName } from "../site/pokemon-style";

const tabs = [
  ["all", "Tout"],
  ["types", "Types"],
  ["weather", "Météo"],
  ["stickers", "Stickers"],
  ["shuffle", "Shuffle"],
  ["go", "Pokémon GO"],
  ["moves", "Attaques"],
];

const tabLabels = Object.fromEntries(tabs);

const filterLabels = {
  all: "Tous",
  normal: "Normal",
  shiny: "Shiny",
  shadow: "Shadow",
  purified: "Purifié",
  mega: "Méga",
  primal: "Primo",
  dynamax: "Dynamax",
  gigantamax: "Gigantamax",
  event: "Event",
  alola: "Alola",
  galar: "Galar",
  hisui: "Hisui",
  paldea: "Paldea",
  fast: "Rapides",
  charged: "Chargées",
  elite: "Elite",
  max: "Max",
  gmax: "GMax",
};

const fieldClass =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 text-sm font-bold text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10";

function lower(value) {
  return String(value || "").toLowerCase();
}

function textOf(value) {
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return String(value || "").toLowerCase();
  }
}

function moveTitle(move) {
  return move.names?.French || move.names?.English || move.name || move.id;
}

function makeSearch(item) {
  return [
    item.title,
    item.subtitle,
    item.collection,
    item.type,
    item.category,
    item.state,
    item.filename,
    item.file,
    item.form,
    item.details,
    ...(item.tags || []),
    textOf(item.raw),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function tagsFor(item) {
  const text = makeSearch(item);
  const tags = new Set((item.tags || []).map(lower));
  if (["types", "weather"].includes(item.collection)) return [item.collection];
  for (const token of [
    "shadow",
    "purified",
    "mega",
    "primal",
    "dynamax",
    "gigantamax",
    "event",
    "alola",
    "galar",
    "hisui",
    "paldea",
  ]) {
    if (text.includes(token)) tags.add(token);
  }
  if (item.shiny || text.includes("shiny") || text.includes("chromatique")) tags.add("shiny");
  if (["go", "shuffle"].includes(item.collection) && !tags.has("shiny")) tags.add("normal");
  if (text.includes("quick") || text.includes("fast") || text.includes("rapide")) tags.add("fast");
  if (text.includes("cinematic") || text.includes("charged") || text.includes("charg")) tags.add("charged");
  if (text.includes("elite")) tags.add("elite");
  if (text.includes("max")) tags.add("max");
  if (text.includes("gmax")) tags.add("gmax");
  return [...tags];
}

function normalize(collection, item, index) {
  const image = item.assets?.background || item.assets?.icon || item.image || item.url;
  const title =
    item.names?.French ||
    item.names?.English ||
    item.label ||
    item.name ||
    item.id ||
    item.filename ||
    `${tabLabels[collection]} ${index + 1}`;
  const subtitle =
    item.category ||
    item.state ||
    item.form ||
    item.type ||
    item.kind ||
    item.details ||
    item.filename ||
    collection;
  const normalized = {
    ...item,
    collection,
    image,
    title,
    subtitle,
    raw: item,
    tags: [
      collection,
      item.category,
      item.state,
      item.form,
      item.type,
      item.kind,
      item.moveType,
      item.shiny ? "shiny" : "",
      item.details,
    ].filter(Boolean),
  };
  normalized.tags = tagsFor(normalized);
  normalized.searchText = makeSearch(normalized);
  return normalized;
}

function buildCollections(catalog, audit) {
  return {
    types: (catalog?.types || []).map((item, index) => normalize("types", item, index)),
    weather: (catalog?.weather || []).map((item, index) => normalize("weather", item, index)),
    stickers: (catalog?.stickers || []).map((item, index) => normalize("stickers", item, index)),
    shuffle: (audit?.shuffleAssets || []).map((item, index) => normalize("shuffle", item, index)),
    go: (audit?.goAssets || []).map((item, index) => normalize("go", item, index)),
    moves: (catalog?.moves || []).map((item, index) =>
      normalize("moves", { ...item, title: moveTitle(item), subtitle: item.type || item.category || item.kind }, index),
    ),
  };
}

function collectionItems(collections, tab) {
  if (tab === "all") return Object.values(collections).flat();
  return collections[tab] || [];
}

function availableSubfilters(items) {
  const order = [
    "all",
    "normal",
    "shiny",
    "shadow",
    "purified",
    "mega",
    "primal",
    "dynamax",
    "gigantamax",
    "event",
    "alola",
    "galar",
    "hisui",
    "paldea",
    "fast",
    "charged",
    "elite",
    "max",
    "gmax",
  ];
  const present = new Set(items.flatMap((item) => item.tags || []));
  return order.filter((key) => key === "all" || present.has(key));
}

function GroupTitle({ label, count }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-black text-white">{label}</h2>
      <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-slate-300">
        {count}
      </span>
    </div>
  );
}

function AssetTile({ item, onPreview }) {
  return (
    <button
      className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-slate-950/45 text-left shadow-[0_18px_55px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-400/10"
      type="button"
      onClick={() => item.image && onPreview(item)}
    >
      <div className="grid aspect-square place-items-center bg-[radial-gradient(circle_at_30%_15%,rgba(125,211,252,.18),transparent_42%),rgba(255,255,255,.035)] p-3">
        {item.image ? (
          <img className="max-h-full object-contain drop-shadow-2xl" src={item.image} alt={item.title} />
        ) : (
          <span className="h-12 w-12 rounded-full bg-white/10" />
        )}
      </div>
      <div className="border-t border-white/10 p-3">
        <strong className="block truncate text-sm font-black text-white">{item.title}</strong>
        <span className="mt-1 block truncate text-xs font-bold text-slate-400">{item.subtitle || tabLabels[item.collection]}</span>
      </div>
    </button>
  );
}

function MoveCard({ move, typeCatalog = [] }) {
  const [open, setOpen] = useState(false);
  const type = move.type || move.raw?.type;
  return (
    <article className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-slate-950/45">
      <button
        className="grid w-full gap-3 p-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0">
          <strong className="block truncate font-black text-white">{moveTitle(move)}</strong>
          <small className="mt-1 block truncate text-xs font-bold text-slate-400">{move.id}</small>
        </span>
        <span
          className="inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-black text-white"
          style={{ background: `color-mix(in srgb, ${typeColors[type] || "#64748b"} 52%, rgba(255,255,255,.12))` }}
        >
          {typeIcon(type, typeCatalog) ? (
            <img className="h-4 w-4 shrink-0 object-contain" src={typeIcon(type, typeCatalog)} alt="" />
          ) : null}
          <span className="truncate">{typeName(type, typeCatalog)}</span>
        </span>
        <span className="inline-flex items-center justify-end gap-2 text-xs font-black text-slate-300">
          {move.power ?? "-"} puissance <ChevronDown className={open ? "rotate-180 transition" : "transition"} size={15} />
        </span>
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-white/10 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Catégorie", move.category || move.kind || move.moveType || "-"],
            ["Énergie", move.energy ?? move.combat?.energy ?? "-"],
            ["Durée", move.durationMs ? `${move.durationMs} ms` : "-"],
            ["Tours PvP", move.combat?.turns ?? "-"],
            ["Puissance PvP", move.combat?.power ?? "-"],
            ["Buffs", move.combat?.buffs ? JSON.stringify(move.combat.buffs) : "-"],
            ["Type", typeName(type, typeCatalog)],
            ["Slug", move.slug || "-"],
          ].map(([label, value]) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3" key={label}>
              <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
              <strong className="mt-1 block break-words text-white">{value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PreviewModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/86 p-4 backdrop-blur-md" role="presentation" onClick={onClose}>
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111f] shadow-[0_32px_120px_rgba(0,0,0,.65)]" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <strong className="block truncate text-xl font-black text-white">{item.title}</strong>
            <span className="mt-1 block truncate text-sm font-bold text-slate-400">{tabLabels[item.collection]} · {item.subtitle}</span>
          </div>
          <button className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/10 text-white" type="button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>
        <div className="grid max-h-[78dvh] place-items-center overflow-auto bg-[radial-gradient(circle_at_30%_18%,rgba(14,165,233,.16),transparent_36%),#020617] p-5">
          <img className="max-h-[70dvh] object-contain drop-shadow-2xl" src={item.image} alt={item.title} />
        </div>
      </div>
    </div>
  );
}

export function AssetsApp() {
  const [catalog, setCatalog] = useState(null);
  const [audit, setAudit] = useState(null);
  const [tab, setTab] = useState("all");
  const [subfilter, setSubfilter] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/checklist-v3?action=catalog").then((response) => response.json()),
      fetch("/api/checklist-v3?action=assets").then((response) => response.json()),
    ])
      .then(([catalogPayload, assetPayload]) => {
        if (cancelled) return;
        setCatalog(catalogPayload.data);
        setAudit(assetPayload.data);
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const collections = useMemo(() => buildCollections(catalog, audit), [audit, catalog]);
  const baseItems = useMemo(() => {
    const items = collectionItems(collections, tab);
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const searchOk = !needle || item.searchText.includes(needle);
      const filterOk = subfilter === "all" || (item.tags || []).includes(subfilter);
      return searchOk && filterOk;
    });
  }, [collections, search, subfilter, tab]);
  const subfilters = useMemo(
    () => availableSubfilters(collectionItems(collections, tab)),
    [collections, search, tab],
  );
  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of baseItems) {
      if (!map.has(item.collection)) map.set(item.collection, []);
      map.get(item.collection).push(item);
    }
    return [...map.entries()];
  }, [baseItems]);

  return (
    <main className="mx-4 max-w-[1680px] py-6 pb-20 sm:mx-auto">
      <section
        className="mb-5 overflow-hidden rounded-[2.4rem] border border-white/10 bg-slate-950 p-5 shadow-[0_34px_120px_rgba(0,0,0,.36)] sm:p-7"
        style={{
          backgroundImage: `linear-gradient(110deg,rgba(2,6,23,.94),rgba(8,47,73,.72)),url("${uiAssets.backgrounds.blue}")`,
          backgroundSize: "cover",
        }}
      >
        <span className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
          Bibliothèques publiques
        </span>
        <h1 className="mt-3 max-w-4xl text-4xl font-black leading-none text-white md:text-6xl">
          Assets, stickers, météo, types et attaques.
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-slate-300 sm:text-base">
          Recherche globale, filtres par famille et aperçu plein écran pour contrôler rapidement les ressources exposées par l’API.
        </p>
      </section>

      {error ? (
        <section className="rounded-[2rem] border border-rose-300/20 bg-rose-500/10 p-5">
          <h2 className="font-black">Impossible de charger les bibliothèques</h2>
          <p className="mt-2 text-sm text-rose-200">{error}</p>
        </section>
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Images Pokémon GO" value={audit?.totals?.goFiles || 0} />
            <MetricCard label="Images Shuffle" value={audit?.totals?.shuffleFiles || 0} accent="violet" />
            <MetricCard label="Attaques" value={catalog?.moves?.length || 0} accent="green" />
            <MetricCard label="Stickers" value={catalog?.stickers?.length || 0} accent="amber" />
          </section>

          <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.055] p-3 shadow-[0_22px_90px_rgba(0,0,0,.2)]">
            <div className="grid gap-3 lg:grid-cols-[1fr_minmax(290px,.62fr)]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
                {tabs.map(([id, label]) => (
                  <button
                    className={`min-h-11 rounded-2xl border px-3 text-sm font-black transition ${
                      tab === id && !search.trim()
                        ? "border-cyan-200/50 bg-cyan-400/20 text-cyan-50"
                        : "border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10"
                    }`}
                    key={id}
                    type="button"
                    onClick={() => {
                      setTab(id);
                      setSubfilter("all");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  className={`${fieldClass} pl-11`}
                  placeholder="Recherche globale: nom, type, forme, fichier..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
            {subfilters.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {subfilters.map((id) => (
                <button
                  className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                    subfilter === id
                      ? "border-emerald-200/50 bg-emerald-400/20 text-emerald-50"
                      : "border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/10"
                  }`}
                  key={id}
                  type="button"
                  onClick={() => setSubfilter(id)}
                >
                  {filterLabels[id] || id}
                </button>
                ))}
              </div>
            ) : null}
            {search.trim() && tab === "all" ? (
              <p className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100">
                Recherche globale active: les résultats de toutes les bibliothèques sont regroupés sur cette page.
              </p>
            ) : null}
          </section>

          <section className="space-y-6">
            {grouped.length ? (
              grouped.map(([collection, items]) => (
                <section key={collection}>
                  <GroupTitle label={tabLabels[collection]} count={items.length} />
                  {collection === "moves" ? (
                    <div className="grid gap-3">
                      {items.slice(0, 260).map((move) => (
                        <MoveCard move={move.raw || move} typeCatalog={catalog?.types || []} key={move.id} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7">
                      {items.slice(0, 260).map((item, index) => (
                        <AssetTile item={item} onPreview={setPreview} key={`${item.collection}-${item.id || item.filename || index}`} />
                      ))}
                    </div>
                  )}
                </section>
              ))
            ) : (
              <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.04] p-8 text-center">
                <strong className="block text-xl font-black text-white">Aucun résultat.</strong>
                <span className="mt-2 block text-sm font-bold text-slate-400">Change le filtre ou vide la recherche.</span>
              </section>
            )}
          </section>
        </>
      )}
      <PreviewModal item={preview} onClose={() => setPreview(null)} />
    </main>
  );
}
