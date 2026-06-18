import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Database,
  FileJson,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { MetricCard } from "../components/site/metric-card";
import { PokemonCard } from "../components/checklist/pokemon-card";
import { uiAssets } from "../components/site/ui-assets";

const { loadSiteDashboard } = require("../src/lib/site-dashboard");

const ctaClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition";
const glassCard =
  "rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-[0_26px_100px_rgba(0,0,0,.28)] backdrop-blur-xl";

function ProgressList({ title, items, valueLabel = "percent" }) {
  return (
    <section className={glassCard}>
      <h2 className="mb-4 text-xl font-black text-white">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => {
          const percent = item.percent ?? Math.round((item.complete / Math.max(item.count, 1)) * 100);
          const value = valueLabel === "count" ? item.count : `${percent}%`;
          return (
            <div className="grid grid-cols-[7.2rem_1fr_3.4rem] items-center gap-3 text-sm" key={item.id || item.generation}>
              <span className="truncate font-bold text-slate-300">
                {item.label || item.id || `Gén. ${item.generation}`}
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-white/10">
                <i
                  className="block h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-400 to-sky-500"
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </span>
              <strong className="text-right font-black text-white">{value}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FeatureCard({ href, icon, title, text, accent = "cyan" }) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-300/18 bg-emerald-400/10 text-emerald-100"
      : accent === "amber"
        ? "border-sky-300/18 bg-sky-400/10 text-sky-100"
        : "border-cyan-300/18 bg-cyan-400/10 text-cyan-100";
  return (
    <Link
      className={`group rounded-[2rem] border ${accentClass} p-5 shadow-[0_20px_80px_rgba(0,0,0,.22)] transition hover:-translate-y-1 hover:border-white/20`}
      href={href}
    >
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-slate-950/35">
        {icon}
      </div>
      <strong className="block text-xl font-black text-white">{title}</strong>
      <span className="mt-2 block text-sm font-bold leading-6 text-slate-300">{text}</span>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white">
        Ouvrir <ArrowRight className="transition group-hover:translate-x-1" size={16} />
      </span>
    </Link>
  );
}

function formatFreshDate(freshness) {
  if (!freshness?.iso && !freshness?.date) return "Indisponible";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: freshness.iso ? "short" : undefined,
    }).format(new Date(freshness.iso || `${freshness.date}T00:00:00`));
  } catch {
    return freshness.date || "Indisponible";
  }
}

export default function HomePage() {
  const dashboard = loadSiteDashboard();
  const dataFreshness = dashboard.freshness?.data;
  const repoFreshness = dashboard.freshness?.repo;
  const completion = Math.round(
    (dashboard.summary.complete / Math.max(dashboard.summary.total, 1)) * 100,
  );
  const incomplete = dashboard.summary.total - dashboard.summary.complete;
  const categories =
    dashboard.summary.categories.length > 0
      ? dashboard.summary.categories
      : [
          { id: "assets", label: "Assets", count: 0, percent: 100 },
          { id: "moves", label: "Attaques", count: 0, percent: 100 },
          { id: "forms", label: "Formes", count: 0, percent: 100 },
        ];

  return (
    <main className="mx-4 max-w-[1680px] py-6 pb-20 sm:mx-auto">
      <section
        className="relative mb-5 overflow-hidden rounded-[2.4rem] border border-white/10 bg-slate-950 p-5 shadow-[0_40px_140px_rgba(0,0,0,.42)] sm:p-7 lg:p-8"
        style={{
          backgroundImage: `linear-gradient(115deg, rgba(3,7,18,.94), rgba(8,47,73,.74), rgba(5,150,105,.28)), url("${uiAssets.backgrounds.park}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:38px_38px]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-emerald-200/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-100">
              API publique vivante
            </span>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl">
              Toutes les données Pokémon GO dans un Pokédex clair, vérifiable et consultable.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-bold leading-7 text-slate-200 sm:text-lg">
              Fiches Pokémon, formes, assets, météo, attaques, PvP et statistiques de complétion.
              Les données restent visibles en public, les outils de modification restent protégés côté admin.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                className={`${ctaClass} border border-cyan-200/30 bg-cyan-400/18 text-cyan-50 shadow-[0_18px_55px_rgba(14,165,233,.24)] hover:bg-cyan-400/25`}
                href="/checklist"
              >
                <Database size={18} /> Ouvrir le Pokédex
              </Link>
              <Link className={`${ctaClass} border border-white/10 bg-white/10 text-white hover:bg-white/15`} href="/assets">
                <Sparkles size={18} /> Explorer les bibliothèques
              </Link>
            </div>
          </div>
          <aside className="rounded-[2rem] border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
            <img
              className="mx-auto mb-5 max-h-28 object-contain drop-shadow-[0_14px_40px_rgba(255,255,255,.18)]"
              src={uiAssets.icons.goLogo}
              alt="Pokémon GO"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Complétion JSON" value={`${completion}%`} accent="green" icon={uiAssets.icons.bookSpells} />
              <MetricCard label="JSON incomplets" value={incomplete} accent="amber" icon={uiAssets.icons.problem} />
              <MetricCard label="Attaques" value={dashboard.catalog.moves} accent="violet" icon={uiAssets.icons.swords} />
              <MetricCard label="Assets indexés" value={dashboard.catalog.stickers + dashboard.catalog.types + dashboard.catalog.weather} icon={uiAssets.icons.result} />
            </div>
          </aside>
        </div>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Fiches analysées" value={dashboard.summary.total} icon={uiAssets.icons.fiche} />
        <MetricCard label="Terminées" value={dashboard.summary.complete} accent="green" icon={uiAssets.icons.bookSpells} />
        <MetricCard label="JSON incomplets" value={incomplete} accent="amber" icon={uiAssets.icons.problem} />
        <MetricCard label="Problèmes détectés" value={dashboard.summary.issues} accent="violet" icon={uiAssets.icons.problem} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1.1fr_.9fr_.9fr]">
        <ProgressList
          title="Complétion par génération"
          items={dashboard.summary.generations.map((item) => ({ ...item, label: `Génération ${item.generation}` }))}
        />
        <ProgressList title="Familles de fiches" items={dashboard.summary.kinds} />
        <ProgressList title="Points à surveiller" items={categories.map((item) => ({ ...item, percent: item.count ? Math.min(100, item.count) : 100 }))} valueLabel="count" />
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-4">
        <FeatureCard
          href="/checklist"
          icon={<img className="h-9 w-9 object-contain" src={uiAssets.icons.pokedex} alt="" />}
          title="Pokédex public"
          text="Recherche par nom, numéro, génération, forme régionale et statut JSON."
        />
        <FeatureCard
          href="/assets"
          accent="emerald"
          icon={<img className="h-9 w-9 object-contain" src={uiAssets.icons.pokemon} alt="" />}
          title="Bibliothèques"
          text="Types, météo, stickers, assets Pokémon GO, Shuffle et attaques détaillées."
        />
        <FeatureCard
          href="/swagger"
          icon={<FileJson size={30} />}
          title="API interactive"
          text="Tester les endpoints publics directement depuis le navigateur."
        />
        <FeatureCard
          href="/api-docs"
          accent="amber"
          icon={<BookOpen size={30} />}
          title="Documentation"
          text="Routes, modèles JSON, catalogues et OpenAPI pour intégrer l’API proprement."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <section className={glassCard}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Fiches JSON incomplètes</h2>
              <p className="mt-1 text-sm font-bold text-slate-400">
                Les contrôles restent visibles pour repérer rapidement les fiches à reprendre.
              </p>
            </div>
            <Link className="text-sm font-black text-cyan-200" href="/checklist">
              Tout voir
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {dashboard.needsAttention.length ? (
              dashboard.needsAttention.slice(0, 4).map((entry) => (
                <PokemonCard key={entry.key} entry={entry} compact />
              ))
            ) : (
              <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-400/10 p-5 text-emerald-100 lg:col-span-2">
                <ShieldCheck className="mb-3" size={24} />
                <strong className="block text-lg font-black">Aucune fiche critique à afficher.</strong>
                <span className="mt-1 block text-sm font-bold text-emerald-100/75">
                  Les contrôles publics ne détectent pas de problème bloquant sur le dataset actuel.
                </span>
              </div>
            )}
          </div>
        </section>
        <aside className={glassCard}>
          <h2 className="text-xl font-black">Fraîcheur des données</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-300">
            La checklist lit les JSON du dépôt et expose la dernière mise à jour connue du dataset.
          </p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Dernière mise à jour data</span>
              <strong className="mt-2 block text-white">{dataFreshness?.subject || "Dataset local"}</strong>
              <span className="mt-1 block text-sm font-bold text-cyan-100">
                {formatFreshDate(dataFreshness)}
              </span>
              <span className="mt-1 block font-mono text-xs text-slate-400">
                {dataFreshness?.source || "Rapport indisponible"}
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Version applicative</span>
              <strong className="mt-2 block break-words text-base leading-snug text-white">
                {repoFreshness?.subject || "Commit non exposé au runtime"}
              </strong>
              <span className="mt-1 block break-words font-mono text-xs text-cyan-200/75">
                {repoFreshness ? `${repoFreshness.hash} · ${repoFreshness.date}` : "Vérifiable côté dépôt GitHub"}
              </span>
            </div>
            <Link className={`${ctaClass} border border-white/10 bg-white/10 text-white hover:bg-white/15`} href="/health">
              <Activity size={18} /> Vérifier le statut API
            </Link>
            <Link className={`${ctaClass} border border-white/10 bg-white/10 text-white hover:bg-white/15`} href="/api-docs.json">
              <FileJson size={18} /> Télécharger OpenAPI JSON
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
