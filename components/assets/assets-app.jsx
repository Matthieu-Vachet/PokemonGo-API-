"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../site/metric-card";

export function AssetsApp() {
  const [catalog, setCatalog] = useState(null);
  const [audit, setAudit] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/checklist-v3?action=catalog").then((response) => response.json()),
      fetch("/api/checklist-v3?action=assets").then((response) => response.json()),
    ])
      .then(([bootstrap, assets]) => {
        if (cancelled) return;
        setCatalog(bootstrap.data);
        setAudit(assets.data);
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stickers = useMemo(() => {
    const list = catalog?.stickers || [];
    return list.filter((sticker) =>
      `${sticker.id} ${sticker.filename} ${sticker.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [catalog, search]);

  return (
    <main className="page-shell">
      <section className="surface hero-subpage">
        <span className="eyebrow">Bibliothèques</span>
        <h1>Assets Pokémon GO, météo, types, stickers et audits</h1>
        <p className="lede">
          Consultation publique des catalogues visuels et des volumes d’assets déjà
          connectés à l’API.
        </p>
      </section>

      {error ? (
        <section className="surface empty-state-card">
          <h2>Impossible de charger les bibliothèques</h2>
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className="metrics-grid">
            <MetricCard label="Images Pokémon GO" value={audit?.totals?.goFiles || 0} />
            <MetricCard label="Images Shuffle" value={audit?.totals?.shuffleFiles || 0} accent="violet" />
            <MetricCard label="Types" value={catalog?.types?.length || 0} accent="green" />
            <MetricCard label="Stickers" value={catalog?.stickers?.length || 0} accent="amber" />
          </section>

          <section className="content-grid two">
            <div className="surface">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Types</span>
                  <h2>Fonds et icônes</h2>
                </div>
              </div>
              <div className="icon-cloud">
                {(catalog?.types || []).map((type) => (
                  <div className="icon-token" key={type.id}>
                    {type.assets?.background ? (
                      <img src={type.assets.background} alt="" />
                    ) : null}
                    <span>{type.names?.French || type.id}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="surface">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Météo</span>
                  <h2>Boosts disponibles</h2>
                </div>
              </div>
              <div className="icon-cloud">
                {(catalog?.weather || []).map((weather) => (
                  <div className="icon-token" key={weather.id}>
                    {weather.assets?.icon ? <img src={weather.assets.icon} alt="" /> : null}
                    <span>{weather.names?.French || weather.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="surface">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Stickers</span>
                <h2>Catalogue consultable</h2>
              </div>
            </div>
            <input
              className="field"
              placeholder="Rechercher un sticker par id, fichier ou catégorie"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="sticker-grid">
              {stickers.slice(0, 120).map((sticker) => (
                <article className="sticker-card" key={sticker.id}>
                  <img src={sticker.image} alt={sticker.id} />
                  <strong>{sticker.id}</strong>
                  <span>{sticker.category}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
