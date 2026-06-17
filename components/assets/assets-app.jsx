"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../site/metric-card";

const tabs = [
  ["types", "Types"],
  ["weather", "Météo"],
  ["stickers", "Stickers"],
  ["shuffle", "Shuffle"],
  ["go", "Pokémon GO"],
  ["moves", "Attaques"],
];

const fieldClass =
  "min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300";

function AssetTile({ item, index }) {
  const image = item.assets?.background || item.assets?.icon || item.image || item.url;
  const title =
    item.names?.French ||
    item.label ||
    item.name ||
    item.id ||
    item.filename ||
    `Asset ${index + 1}`;
  return (
    <article className="rounded-lg border border-white/10 bg-zinc-950/55 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      {image ? (
        <img className="aspect-square w-full rounded-md bg-white/[0.06] object-contain p-2" src={image} alt={title} />
      ) : (
        <span className="block aspect-square rounded-md bg-white/[0.06]" />
      )}
      <strong className="mt-2 block break-words text-sm">{title}</strong>
      <span className="text-xs text-slate-400">{item.category || item.state || item.form || item.type || item.id}</span>
    </article>
  );
}

export function AssetsApp() {
  const [catalog, setCatalog] = useState(null);
  const [audit, setAudit] = useState(null);
  const [tab, setTab] = useState("types");
  const [search, setSearch] = useState("");
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

  const items = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const source =
      tab === "types"
        ? catalog?.types || []
        : tab === "weather"
          ? catalog?.weather || []
          : tab === "stickers"
            ? catalog?.stickers || []
            : tab === "shuffle"
              ? audit?.shuffleAssets || []
              : tab === "go"
                ? audit?.goAssets || []
                : catalog?.moves || [];
    if (!needle) return source;
    return source.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(needle),
    );
  }, [audit, catalog, search, tab]);

  return (
    <main className="mx-4 max-w-[1480px] py-6 pb-20 sm:mx-auto">
      <section className="mb-5">
        <span className="text-xs font-black uppercase tracking-wide text-sky-300">
          Bibliothèques
        </span>
        <h1 className="mt-2 max-w-4xl text-3xl font-black leading-none text-white md:text-5xl">
          Assets, stickers, météo, types et attaques
        </h1>
      </section>

      {error ? (
        <section className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-5">
          <h2 className="font-black">Impossible de charger les bibliothèques</h2>
          <p className="mt-2 text-sm text-rose-200">{error}</p>
        </section>
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Images Pokémon GO" value={audit?.totals?.goFiles || 0} />
            <MetricCard label="Images Shuffle" value={audit?.totals?.shuffleFiles || 0} accent="violet" />
            <MetricCard label="Types" value={catalog?.types?.length || 0} accent="green" />
            <MetricCard label="Stickers" value={catalog?.stickers?.length || 0} accent="amber" />
          </section>

          <section className="mb-5 grid gap-3 rounded-lg border border-white/10 bg-white/[0.055] p-3 lg:grid-cols-[1.6fr_minmax(260px,.8fr)]">
            <div className="flex flex-wrap gap-2">
              {tabs.map(([id, label]) => (
                <button
                  className={`min-h-10 rounded-lg border px-3 text-sm font-black transition ${
                    tab === id
                      ? "border-transparent bg-gradient-to-r from-rose-500 to-sky-400 text-white"
                      : "border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/10"
                  }`}
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              className={fieldClass}
              placeholder="Rechercher dans la bibliothèque"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </section>

          {tab === "moves" ? (
            <section className="rounded-lg border border-white/10 bg-white/[0.055] p-4">
              <div className="grid gap-2">
                {items.slice(0, 260).map((move) => (
                  <div className="grid min-h-11 gap-2 rounded-lg border border-white/10 bg-white/[0.045] p-3 text-sm md:grid-cols-[minmax(180px,1fr)_100px_120px_80px]" key={move.id}>
                    <strong>{move.names?.French || move.names?.English || move.id}</strong>
                    <span className="text-slate-400">{move.type || "-"}</span>
                    <span className="text-slate-400">{move.category || move.kind || "-"}</span>
                    <span className="text-slate-400">{move.power ?? "-"}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7">
              {items.slice(0, 240).map((item, index) => (
                <AssetTile item={item} index={index} key={`${item.id || item.filename || index}`} />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
