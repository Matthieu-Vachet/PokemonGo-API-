"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Code2, LayoutDashboard, ScrollText } from "lucide-react";
import { MetricCard } from "../site/metric-card";
import { PokemonCard } from "./pokemon-card";
import { DetailModal } from "./detail-modal";
import { uiAssets } from "../site/ui-assets";

const pageSize = 120;
const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-black text-slate-100 transition hover:border-white/20 hover:bg-white/10";
const fieldClass =
  "min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300";

function useChecklistData() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: null,
    catalog: null,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/checklist-v3").then((response) => response.json()),
      fetch("/api/checklist-v3?action=catalog").then((response) => response.json()),
    ])
      .then(([bootstrap, catalog]) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: "",
          payload: bootstrap.data,
          catalog: catalog.data,
        });
      })
      .catch((error) => {
        if (!cancelled)
          setState({ loading: false, error: error.message, payload: null, catalog: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function familyLabel(kind) {
  return {
    pokemon: "Pokémon",
    form: "Forme",
    mega: "Méga / Primo",
    dynamax: "Dynamax",
    gigantamax: "Gigantamax",
  }[kind] || kind;
}

export function ChecklistApp({ mode = "public" }) {
  const data = useChecklistData();
  const [search, setSearch] = useState("");
  const [generation, setGeneration] = useState("all");
  const [kind, setKind] = useState("all");
  const [formFilter, setFormFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");

  const entries = data.payload?.entries || [];
  const summary = data.payload?.summary;
  const catalog = data.catalog || {};

  const generations = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.generation).filter(Boolean))].sort(
        (left, right) => left - right,
      ),
    [entries],
  );

  const formOptions = useMemo(() => {
    const labels = {
      alola: "Alola",
      galar: "Galar",
      hisui: "Hisui",
      paldea: "Paldea",
      mega: "Méga",
      primal: "Primo",
      dynamax: "Dynamax",
      gigantamax: "Gigantamax",
      shadow: "Shadow",
      purified: "Purifié",
      event: "Event",
    };
    const available = new Set();
    for (const entry of entries) {
      const text = [
        entry.form,
        entry.kind,
        entry.profile,
        entry.file,
        entry.slug,
        entry.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      for (const id of Object.keys(labels)) {
        if (text.includes(id)) available.add(id);
      }
    }
    return [...available].sort().map((id) => ({ id, label: labels[id] || id }));
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const haystack = [
        entry.name,
        entry.dexId,
        entry.form,
        entry.kind,
        entry.profile,
        entry.primaryType,
        entry.secondaryType,
        entry.file,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const searchOk = !needle || haystack.includes(needle);
      const generationOk =
        generation === "all" || String(entry.generation || "") === generation;
      const kindOk = kind === "all" || entry.kind === kind;
      const formOk =
        formFilter === "all" ||
        [
          entry.form,
          entry.kind,
          entry.profile,
          entry.file,
          entry.slug,
          entry.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(formFilter);
      const statusOk =
        status === "all" ||
        (status === "complete" ? entry.complete : !entry.complete);
      return searchOk && generationOk && kindOk && formOk && statusOk;
    });
  }, [entries, formFilter, generation, kind, search, status]);

  const visible = filtered.slice(0, visibleCount);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  async function openDetail(entry) {
    const index = filtered.findIndex((item) => item.key === entry.key);
    setSelectedIndex(index);
    setDetail(null);
    setDetailError("");
    try {
      const response = await fetch(
        `/api/checklist-v3?action=detail&key=${encodeURIComponent(entry.key)}`,
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Erreur de chargement.");
      setDetail(payload.data);
    } catch (error) {
      setDetailError(error.message);
      setDetail({ detail: { error: error.message } });
    }
  }

  function shiftDetail(delta) {
    if (!filtered.length) return;
    const nextIndex = (selectedIndex + delta + filtered.length) % filtered.length;
    openDetail(filtered[nextIndex]);
  }

  function resetFilters(nextValue, setter) {
    setter(nextValue);
    setVisibleCount(pageSize);
  }

  return (
    <main className="mx-4 max-w-[1480px] py-6 pb-20 sm:mx-auto">
      <section className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-sky-300">
            Pokédex checklist
          </span>
          <h1 className="mt-2 max-w-4xl text-3xl font-black leading-none text-white md:text-5xl">
            Visualisation complète des données Pokémon GO
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonClass} href="/api-docs"><ScrollText size={16} /> Documentation</Link>
          <Link className={buttonClass} href="/swagger"><Code2 size={16} /> API interactive</Link>
          <Link className={buttonClass} href="/api-docs.json"><BookOpen size={16} /> OpenAPI</Link>
          <Link className={`${buttonClass} border-cyan-200/30 bg-cyan-400/15 text-cyan-50 hover:bg-cyan-400/20`} href="/admin">
            <LayoutDashboard size={16} /> Dashboard admin
          </Link>
        </div>
      </section>

      {data.loading ? (
        <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5">
          <h2 className="font-black">Chargement des fiches...</h2>
        </section>
      ) : data.error ? (
        <section className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-5">
          <h2 className="font-black">Chargement impossible</h2>
          <p className="mt-2 text-sm text-rose-200">{data.error}</p>
        </section>
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Fiches analysées" value={summary?.total || 0} />
            <MetricCard label="Terminées" value={summary?.complete || 0} accent="green" />
            <MetricCard label="Problèmes" value={summary?.issues || 0} accent="amber" />
            <MetricCard label="Résultats" value={filtered.length} accent="violet" />
          </section>

          <section className="mb-5 grid gap-3 rounded-lg border border-white/10 bg-white/[0.055] p-4 md:grid-cols-4">
            <div>
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">Fraîcheur</span>
              <strong className="mt-1 block text-lg text-emerald-200">Dataset chargé en direct</strong>
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">Catalogues</span>
              <strong className="mt-1 block text-lg text-sky-200">
                {(catalog.moves?.length || 0) + (catalog.types?.length || 0) + (catalog.weather?.length || 0)}
              </strong>
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">Assets publics</span>
              <strong className="mt-1 block text-lg text-violet-200">
                {(catalog.stickers?.length || 0).toLocaleString("fr-FR")} stickers
              </strong>
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">Lecture</span>
              <strong className="mt-1 block text-lg text-amber-200">Mode visiteur sécurisé</strong>
            </div>
          </section>

          <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.055] p-3 shadow-[0_22px_90px_rgba(0,0,0,.2)]">
            <div className="grid gap-2 lg:grid-cols-[minmax(260px,1.2fr)_repeat(3,minmax(150px,.55fr))]">
              <input
                className={fieldClass}
                placeholder="Pokémon, numéro, forme, type, fichier..."
                value={search}
                onChange={(event) => resetFilters(event.target.value, setSearch)}
              />
              <select className={fieldClass} value={kind} onChange={(event) => resetFilters(event.target.value, setKind)}>
                <option value="all">Toutes familles</option>
                {[...new Set(entries.map((entry) => entry.kind))].sort().map((value) => (
                  <option key={value} value={value}>{familyLabel(value)}</option>
                ))}
              </select>
              <select className={fieldClass} value={formFilter} onChange={(event) => resetFilters(event.target.value, setFormFilter)}>
                <option value="all">Toutes formes</option>
                {formOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <select className={fieldClass} value={status} onChange={(event) => resetFilters(event.target.value, setStatus)}>
                <option value="all">Tous statuts</option>
                <option value="complete">JSON complet</option>
                <option value="todo">JSON incomplet</option>
              </select>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
              <button
                className={`min-h-20 rounded-2xl border px-2 py-2 text-xs font-black transition ${
                  generation === "all"
                    ? "border-cyan-200/50 bg-cyan-400/20 text-white"
                    : "border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/10"
                }`}
                type="button"
                onClick={() => resetFilters("all", setGeneration)}
              >
                Toutes
              </button>
              {generations.map((value) => (
                <button
                  className={`overflow-hidden rounded-2xl border text-xs font-black transition ${
                    String(value) === generation
                      ? "border-cyan-200/60 bg-cyan-400/20 text-white shadow-[0_12px_35px_rgba(14,165,233,.18)]"
                      : "border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/10"
                  }`}
                  key={value}
                  type="button"
                  onClick={() => resetFilters(String(value), setGeneration)}
                >
                  <span className="grid h-14 place-items-center bg-slate-950/35 p-1">
                    {uiAssets.generations[value] ? (
                      <img className="max-h-full object-contain" src={uiAssets.generations[value]} alt="" />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-white/10" />
                    )}
                  </span>
                  <span className="block px-2 py-2">Gén. {value}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((entry) => (
              <PokemonCard
                key={entry.key}
                entry={entry}
                onOpen={openDetail}
                typeCatalog={catalog.types}
                weatherCatalog={catalog.weather}
              />
            ))}
          </section>

          {visible.length < filtered.length ? (
            <div className="mt-6 flex justify-center">
              <button
                className="min-h-11 rounded-2xl border border-cyan-200/30 bg-cyan-400/15 px-4 font-black text-cyan-50 transition hover:bg-cyan-400/20"
                type="button"
                onClick={() => setVisibleCount((count) => count + pageSize)}
              >
                Afficher plus de fiches
              </button>
            </div>
          ) : null}
        </>
      )}

      <DetailModal
        open={Boolean(selected)}
        entry={selected}
        detail={detail || (detailError ? { detail: { error: detailError } } : null)}
        mode={mode}
        typeCatalog={catalog.types}
        weatherCatalog={catalog.weather}
        onPrevious={() => shiftDetail(-1)}
        onNext={() => shiftDetail(1)}
        onClose={() => {
          setSelectedIndex(-1);
          setDetail(null);
          setDetailError("");
        }}
      />
    </main>
  );
}
