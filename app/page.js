import Link from "next/link";
import { Activity, Database, FileJson, HeartPulse } from "lucide-react";
import { MetricCard } from "../components/site/metric-card";
import { PokemonCard } from "../components/checklist/pokemon-card";

const { loadSiteDashboard } = require("../src/lib/site-dashboard");

const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-black text-slate-100 transition hover:border-white/20 hover:bg-white/10";

export default function HomePage() {
  const dashboard = loadSiteDashboard();
  const completion = Math.round(
    (dashboard.summary.complete / Math.max(dashboard.summary.total, 1)) * 100,
  );

  return (
    <main className="mx-4 max-w-[1480px] py-6 pb-20 sm:mx-auto">
      <section className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-sky-300">
            Vue publique
          </span>
          <h1 className="mt-2 max-w-4xl text-3xl font-black leading-none text-white md:text-5xl">
            Pokédex, API et bibliothèques Pokémon GO
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={`${buttonClass} bg-gradient-to-r from-rose-500 to-amber-300 text-zinc-950`} href="/checklist">
            <Database size={16} /> Ouvrir le Pokédex
          </Link>
          <Link className={buttonClass} href="/assets">
            <Activity size={16} /> Bibliothèques
          </Link>
          <Link className={buttonClass} href="/api-docs">
            <FileJson size={16} /> Documentation
          </Link>
          <Link className={buttonClass} href="/swagger">
            <HeartPulse size={16} /> API interactive
          </Link>
        </div>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Fiches analysées" value={dashboard.summary.total} />
        <MetricCard label="Complétion" value={`${completion}%`} accent="green" />
        <MetricCard label="Problèmes détectés" value={dashboard.summary.issues} accent="amber" />
        <MetricCard
          label="Assets catalogués"
          value={dashboard.catalog.stickers + dashboard.catalog.types + dashboard.catalog.weather}
          accent="violet"
        />
      </section>

      <section className="mb-5 grid gap-3 rounded-lg border border-white/10 bg-white/[0.055] p-4 md:grid-cols-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">État données</span>
          <strong className="mt-1 block text-lg text-emerald-200">JSON synchronisés</strong>
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">Couverture</span>
          <strong className="mt-1 block text-lg text-sky-200">Gén. 1 à 9</strong>
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">Catalogues</span>
          <strong className="mt-1 block text-lg text-violet-200">
            {dashboard.catalog.moves + dashboard.catalog.types + dashboard.catalog.weather}
          </strong>
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-slate-400">API</span>
          <strong className="mt-1 block text-lg text-amber-200">Consultation publique</strong>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_.9fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Fiches à surveiller</h2>
            <Link className="text-sm font-black text-sky-300" href="/checklist">
              Tout voir
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {dashboard.needsAttention.length ? (
              dashboard.needsAttention.slice(0, 4).map((entry) => (
                <PokemonCard key={entry.key} entry={entry} compact />
              ))
            ) : (
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-5 text-emerald-100 lg:col-span-2">
                <strong className="block text-lg font-black">Aucune fiche critique à afficher.</strong>
                <span className="mt-1 block text-sm font-bold text-emerald-100/75">
                  Les contrôles publics ne détectent pas de problème bloquant sur le dataset actuel.
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)]">
          <h2 className="mb-4 text-lg font-black">Accès rapides</h2>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Link className={buttonClass} href="/api/v1">Index API</Link>
            <Link className={buttonClass} href="/api-docs.json">OpenAPI JSON</Link>
            <Link className={buttonClass} href="/health">Statut API</Link>
            <Link className={buttonClass} href="/admin">Dashboard admin</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {dashboard.catalog.typePreview.map((type) => (
              <article className="rounded-lg border border-white/10 bg-zinc-950/50 p-2" key={type.id}>
                <img
                  className="aspect-square w-full rounded-md object-cover"
                  src={type.assets?.background || type.assets?.icon}
                  alt={type.names?.French || type.id}
                />
                <strong className="mt-2 block text-sm">{type.names?.French || type.id}</strong>
                <span className="text-xs text-slate-400">Type</span>
              </article>
            ))}
            {dashboard.catalog.weatherPreview.slice(0, 4).map((weather) => (
              <article className="rounded-lg border border-white/10 bg-zinc-950/50 p-2" key={weather.id}>
                <img className="aspect-square w-full rounded-md object-contain p-4" src={weather.assets?.icon} alt={weather.names?.French || weather.id} />
                <strong className="mt-2 block text-sm">{weather.names?.French || weather.id}</strong>
                <span className="text-xs text-slate-400">Météo</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
