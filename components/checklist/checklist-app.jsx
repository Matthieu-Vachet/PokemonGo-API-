"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../site/metric-card";
import { PokemonCard } from "./pokemon-card";
import { DetailModal } from "./detail-modal";

function useBootstrap() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checklist-v3")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setState({ loading: false, error: "", payload: payload.data });
      })
      .catch((error) => {
        if (!cancelled)
          setState({ loading: false, error: error.message, payload: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function ChecklistApp({ mode = "public" }) {
  const bootstrap = useBootstrap();
  const [search, setSearch] = useState("");
  const [generation, setGeneration] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");

  const entries = bootstrap.payload?.entries || [];
  const summary = bootstrap.payload?.summary;

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const haystack =
        `${entry.name} ${entry.dexId} ${entry.form} ${entry.kind}`.toLowerCase();
      const searchOk = !search || haystack.includes(search.toLowerCase());
      const generationOk =
        generation === "all" || String(entry.generation || "") === generation;
      const statusOk =
        status === "all" ||
        (status === "complete" ? entry.complete : !entry.complete);
      return searchOk && generationOk && statusOk;
    });
  }, [entries, generation, search, status]);

  const generations = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.generation).filter(Boolean))].sort(
        (left, right) => left - right,
      ),
    [entries],
  );

  async function openDetail(entry) {
    setSelected(entry);
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

  return (
    <main className="page-shell">
      <section className="surface hero-subpage">
        <span className="eyebrow">Checklist publique</span>
        <h1>Vue lecture seule des données Pokémon GO</h1>
        <p className="lede">
          Les visiteurs peuvent consulter les fiches, les écarts détectés, les
          détails techniques, les statistiques et les assets associés sans toucher
          aux outils d’administration.
        </p>
      </section>

      {bootstrap.loading ? (
        <section className="surface loading-panel">
          <h2>Chargement de la checklist...</h2>
        </section>
      ) : bootstrap.error ? (
        <section className="surface empty-state-card">
          <h2>Impossible de charger la checklist</h2>
          <p>{bootstrap.error}</p>
        </section>
      ) : (
        <>
          <section className="metrics-grid">
            <MetricCard label="Fiches" value={summary?.total || 0} />
            <MetricCard label="Terminées" value={summary?.complete || 0} accent="green" />
            <MetricCard label="Problèmes" value={summary?.issues || 0} accent="amber" />
            <MetricCard label="Filtrées" value={filtered.length} accent="violet" />
          </section>

          <section className="surface filter-bar">
            <input
              className="field"
              placeholder="Pokémon, numéro, forme, type..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="field"
              value={generation}
              onChange={(event) => setGeneration(event.target.value)}
            >
              <option value="all">Toutes les générations</option>
              {generations.map((value) => (
                <option key={value} value={value}>
                  Génération {value}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="complete">Complétées</option>
              <option value="todo">À corriger</option>
            </select>
          </section>

          <section className="card-grid">
            {filtered.map((entry) => (
              <PokemonCard key={entry.key} entry={entry} onOpen={openDetail} />
            ))}
          </section>
        </>
      )}

      <DetailModal
        open={Boolean(selected)}
        entry={selected}
        detail={detail || (detailError ? { detail: { error: detailError } } : null)}
        mode={mode}
        onClose={() => {
          setSelected(null);
          setDetail(null);
          setDetailError("");
        }}
      />
    </main>
  );
}
