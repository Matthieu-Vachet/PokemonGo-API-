import Link from "next/link";
import { MetricCard } from "../components/site/metric-card";
import { SectionCard } from "../components/site/section-card";
import { PokemonCard } from "../components/checklist/pokemon-card";

const { loadSiteDashboard } = require("../src/lib/site-dashboard");

const categoryLabels = {
  assets: "Assets",
  attacks: "Attaques",
  capture: "Capture & disponibilité",
  forms: "Formes & évolutions",
  pvp: "PvP",
  size: "Taille & poids",
  stats: "Statistiques & PC",
  custom: "Règles perso",
};

export default function HomePage() {
  const dashboard = loadSiteDashboard();
  const completion = Math.round(
    (dashboard.summary.complete / Math.max(dashboard.summary.total, 1)) * 100,
  );

  return (
    <main className="page-shell">
      <section className="hero surface hero-grid">
        <div>
          <span className="eyebrow">Pokémon GO API Studio</span>
          <h1>Nouvelle checklist publique, plus propre, plus sûre, plus pro.</h1>
          <p className="lede">
            Un front Next.js pensé pour les visiteurs en lecture seule, avec un
            dashboard admin isolé pour les audits, les corrections et le suivi des
            assets.
          </p>
          <div className="action-row">
            <Link className="button primary" href="/checklist">
              Explorer la checklist
            </Link>
            <Link className="button" href="/assets">
              Voir les bibliothèques
            </Link>
            <Link className="button" href="/admin">
              Espace admin
            </Link>
          </div>
        </div>
        <div className="hero-summary">
          <MetricCard label="Fiches analysées" value={dashboard.summary.total} />
          <MetricCard label="Complétion" value={`${completion}%`} accent="cyan" />
          <MetricCard
            label="Problèmes détectés"
            value={dashboard.summary.issues}
            accent="amber"
          />
          <MetricCard
            label="Stickers indexés"
            value={dashboard.catalog.stickers}
            accent="violet"
          />
        </div>
      </section>

      <section className="content-grid three">
        <SectionCard
          title="Checklist publique"
          eyebrow="Visiteurs"
          description="Toutes les fiches Pokémon, les scores de complétion, les détails techniques, les assets et les bibliothèques sont consultables en lecture seule."
          href="/checklist"
          cta="Ouvrir"
        />
        <SectionCard
          title="Bibliothèques d’assets"
          eyebrow="Catalogue"
          description="Types, météo, stickers, audits d’assets GO/Home/Shuffle et panneaux de consultation conçus pour desktop et mobile."
          href="/assets"
          cta="Explorer"
        />
        <SectionCard
          title="API & documentation"
          eyebrow="Développeurs"
          description="Documentation ReDoc, Swagger interactif, OpenAPI JSON et état de santé restent accessibles publiquement."
          href="/api-docs"
          cta="Documentation"
        />
      </section>

      <section className="surface">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Alertes</span>
            <h2>Fiches qui demandent encore de l’attention</h2>
          </div>
          <Link className="text-link" href="/checklist">
            Voir toute la checklist
          </Link>
        </div>
        <div className="card-grid">
          {dashboard.needsAttention.map((entry) => (
            <PokemonCard key={entry.key} entry={entry} />
          ))}
        </div>
      </section>

      <section className="content-grid two">
        <div className="surface">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Catégories</span>
              <h2>Répartition des écarts</h2>
            </div>
          </div>
          <div className="rank-list">
            {dashboard.summary.categories.slice(0, 7).map((item) => (
              <div className="rank-row" key={item.id}>
                <span>{categoryLabels[item.id] || item.id}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="surface">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Aperçu</span>
              <h2>Bibliothèques disponibles</h2>
            </div>
          </div>
          <div className="icon-cloud">
            {dashboard.catalog.typePreview.map((type) => (
              <div className="icon-token" key={type.id}>
                {type.assets?.icon ? <img src={type.assets.icon} alt="" /> : null}
                <span>{type.names?.French || type.id}</span>
              </div>
            ))}
            {dashboard.catalog.weatherPreview.map((weather) => (
              <div className="icon-token" key={weather.id}>
                {weather.assets?.icon ? <img src={weather.assets.icon} alt="" /> : null}
                <span>{weather.names?.French || weather.id}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
