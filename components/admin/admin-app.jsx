"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileDiff,
  FileJson,
  History,
  LayoutDashboard,
  ListTodo,
  LogOut,
  PenLine,
  Radar,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DetailModal } from "../checklist/detail-modal";
import { PokemonCard } from "../checklist/pokemon-card";
import { MetricCard } from "../site/metric-card";
import { typeColors, typeIcon, typeName } from "../site/pokemon-style";
import { LoginCard } from "./login-card";

const assetChecksKey = "pokedex-v4-asset-checks";
const todoKey = "pokedex-v4-admin-todos";
const editorKey = "pokedex-v4-admin-editor";

const navItems = [
  ["overview", "Accueil", LayoutDashboard],
  ["pokedex", "Fiches", BookOpen],
  ["assets", "Assets", Boxes],
  ["sources", "Veille", Radar],
  ["catalogs", "Catalogues", Archive],
  ["compare", "Comparaison", FileDiff],
  ["bulk", "Corrections", ClipboardCheck],
  ["export", "Export", FileJson],
  ["todo", "Todo-list", ListTodo],
  ["editor", "Éditeur", PenLine],
  ["account", "Compte", Settings],
];

const panelClass =
  "rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 shadow-[0_22px_90px_rgba(0,0,0,.24)] backdrop-blur-xl sm:p-5";
const fieldClass =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.075] px-4 py-2 text-sm font-black text-white transition hover:border-cyan-200/50 hover:bg-cyan-400/15";
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2 text-sm font-black text-white shadow-[0_14px_45px_rgba(14,165,233,.26)] transition hover:scale-[1.01]";

function localJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function copyToClipboard(value) {
  return navigator.clipboard.writeText(
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
  );
}

function Panel({ title, eyebrow, action, children, className = "" }) {
  return (
    <section className={`${panelClass} ${className}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="mb-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-200/70">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BarList({ items, labelKey = "id", valueKey = "count" }) {
  const max = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);
  return (
    <div className="space-y-3">
      {items.length ? (
        items.map((item) => {
          const value = Number(item[valueKey]) || 0;
          return (
            <div className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm" key={item[labelKey]}>
              <span className="truncate font-bold text-slate-300">{item[labelKey]}</span>
              <span className="h-3 overflow-hidden rounded-full bg-white/10">
                <i
                  className="block h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </span>
              <strong className="text-right font-black text-white">{value}</strong>
            </div>
          );
        })
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm font-bold text-slate-400">
          Aucune donnée à afficher.
        </p>
      )}
    </div>
  );
}

function CompletionList({ items }) {
  return (
    <div className="space-y-3">
      {items.length ? (
        items.map((item) => {
          const percent = item.percent ?? Math.round((item.complete / Math.max(item.count, 1)) * 100);
          return (
            <div className="grid grid-cols-[5.5rem_1fr_4.6rem] items-center gap-3 text-sm" key={item.generation || item.id}>
              <span className="truncate font-bold text-slate-300">
                {item.generation ? `Gén. ${item.generation}` : item.id}
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-white/10">
                <i
                  className="block h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-400 to-sky-500"
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </span>
              <strong className="text-right font-black text-white">{percent}%</strong>
              <span className="col-start-2 text-xs font-bold text-slate-500">
                {item.complete || 0}/{item.count || 0} fiches complètes
              </span>
            </div>
          );
        })
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm font-bold text-slate-400">
          Aucune donnée à afficher.
        </p>
      )}
    </div>
  );
}

function HistoryList({ history = [] }) {
  return (
    <div className="space-y-3">
      {history.length ? (
        history.map((item) => (
          <div
            className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"
            key={`${item.hash}-${item.date}`}
          >
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              {item.date}
            </span>
            <strong className="mt-1 block text-sm font-black text-white">{item.subject}</strong>
            <small className="mt-1 block font-mono text-xs text-cyan-200/70">{item.hash}</small>
          </div>
        ))
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm font-bold text-slate-400">
          Historique indisponible pour le moment.
        </p>
      )}
    </div>
  );
}

function CatalogPanel({ catalog = {}, search = "" }) {
  const [tab, setTab] = useState("moves");
  const data = catalog || {};
  const labels = {
    moves: "Attaques",
    types: "Types",
    weather: "Météo",
    stickers: "Stickers",
  };
  const rawItems =
    tab === "moves"
      ? data.moves || []
      : tab === "stickers"
        ? data.stickers || []
        : tab === "weather"
          ? data.weather || []
          : data.types || [];
  const items = rawItems.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Panel
      title="Catalogues complets"
      eyebrow="référentiels"
      action={
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {Object.entries(labels).map(([value, label]) => (
            <button
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${
                tab === value
                  ? "border-cyan-200/40 bg-cyan-400/20 text-cyan-50"
                  : "border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/10"
              }`}
              key={value}
              type="button"
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "moves" ? (
        <div className="overflow-hidden rounded-3xl border border-white/10">
          {items.slice(0, 180).map((item) => (
            <div
              className="grid gap-3 border-b border-white/10 bg-slate-950/35 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
              key={item.id}
            >
              <strong className="min-w-0 truncate font-black text-white">
                {item.names?.French || item.names?.English || item.id}
              </strong>
              <span
                className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 font-bold text-white"
                style={{ background: `color-mix(in srgb, ${typeColors[item.type] || "#64748b"} 52%, rgba(255,255,255,.12))` }}
              >
                {typeIcon(item.type, data.types) ? (
                  <img className="h-4 w-4 object-contain" src={typeIcon(item.type, data.types)} alt="" />
                ) : null}
                {typeName(item.type, data.types)}
              </span>
              <span className="font-black text-cyan-200">{item.category || item.moveType || "-"}</span>
              <span className="font-black text-emerald-200">{item.power ?? "-"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.slice(0, 180).map((item) => {
            const image = item.assets?.background || item.assets?.icon || item.image;
            const label = item.names?.French || item.name || item.id;
            const boosted = Array.isArray(item.boostedTypes) ? item.boostedTypes : [];
            return (
              <article
                className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40"
                key={item.id || item.filename || label}
              >
                <div
                  className="grid aspect-[4/3] place-items-center bg-white/[0.04] p-4"
                  style={{
                    backgroundImage: item.assets?.background
                      ? `linear-gradient(135deg, rgba(2,6,23,.45), rgba(2,6,23,.7)), url("${item.assets.background}")`
                      : undefined,
                    backgroundSize: "cover",
                  }}
                >
                  {image ? (
                    <img className="max-h-full object-contain drop-shadow-2xl" src={item.assets?.icon || item.image || image} alt={label} />
                  ) : (
                    <span className="h-10 w-10 rounded-full bg-white/10" />
                  )}
                </div>
                <div className="border-t border-white/10 p-3">
                  <strong className="block truncate text-sm font-black text-white">
                    {label}
                  </strong>
                  <span className="mt-1 block truncate text-xs font-bold text-slate-400">
                    {item.category || item.id}
                  </span>
                  {boosted.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {boosted.map((type) => (
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-slate-200" key={type}>
                          {typeName(type, data.types)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function MiniCardList({ entries, onOpen }) {
  return (
    <div className="grid gap-3">
      {entries.length ? (
        entries.map((entry) => (
          <button
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-left transition hover:border-cyan-200/40 hover:bg-cyan-400/10"
            key={entry.key}
            type="button"
            onClick={() => onOpen(entry)}
          >
            <span className="min-w-0">
              <strong className="block truncate font-black text-white">{entry.name}</strong>
              <small className="mt-1 block truncate text-xs font-bold text-slate-400">
                {entry.dexId} · {entry.form || entry.kind}
              </small>
            </span>
            <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-100">
              {entry.issues?.length || 0}
            </span>
          </button>
        ))
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm font-bold text-slate-400">
          Rien à afficher ici.
        </p>
      )}
    </div>
  );
}

function SourceRows({ sourceWatch }) {
  if (sourceWatch?.loading) {
    return (
      <p className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm font-bold text-slate-300">
        Vérification en cours...
      </p>
    );
  }
  if (sourceWatch?.error) {
    return (
      <p className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
        {sourceWatch.error}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4 text-sm font-bold leading-6 text-cyan-100">
        La veille interroge les sources configurées et affiche leur dernier état connu. Si une source expose un nouveau commit, tag ou statut différent, elle remonte ici au prochain contrôle.
      </p>
      {(sourceWatch?.sources || []).length ? (
        sourceWatch.sources.map((source) => (
          <a
            className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-slate-950/35 p-4 transition hover:border-cyan-200/40 hover:bg-cyan-400/10 sm:flex-row sm:items-center sm:justify-between"
            href={source.remoteUrl || source.url}
            key={source.id || source.name}
            rel="noreferrer"
            target="_blank"
          >
            <span>
              <strong className="block font-black text-white">{source.name || source.repo || source.url}</strong>
              <small className="mt-1 block text-xs font-bold text-slate-400">{source.message || source.status}</small>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black text-cyan-100">
              {source.version || source.status || "ouvrir"} <ExternalLink size={14} />
            </span>
          </a>
        ))
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm font-bold text-slate-400">
          Lance une vérification pour afficher les sources.
        </p>
      )}
    </div>
  );
}

export function AdminApp() {
  const [session, setSession] = useState({ loading: true, authenticated: false });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [active, setActive] = useState("overview");
  const [bootstrap, setBootstrap] = useState({ loading: false, payload: null, error: "" });
  const [catalog, setCatalog] = useState(null);
  const [assetAudit, setAssetAudit] = useState(null);
  const [sourceWatch, setSourceWatch] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [detail, setDetail] = useState(null);
  const [extraPanel, setExtraPanel] = useState(null);
  const [search, setSearch] = useState("");
  const [assetChecks, setAssetChecks] = useState({});
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [editorText, setEditorText] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [bulkOnlyIssues, setBulkOnlyIssues] = useState(true);
  const [assetTab, setAssetTab] = useState("all");

  useEffect(() => {
    setAssetChecks(localJson(assetChecksKey, {}));
    setTodos(localJson(todoKey, []));
    setEditorText(localStorage.getItem(editorKey) || "");
  }, []);

  async function refreshSession() {
    const response = await fetch("/api/checklist-v3?action=session");
    const payload = await response.json();
    const authenticated = Boolean(payload.data?.authenticated);
    setSession({ loading: false, authenticated });
    return authenticated;
  }

  async function loadAdminData() {
    setBootstrap((current) => ({ ...current, loading: true, error: "" }));
    try {
      const [checklistResponse, catalogResponse, assetResponse, historyResponse] = await Promise.all([
        fetch("/api/checklist-v3"),
        fetch("/api/checklist-v3?action=catalog"),
        fetch("/api/checklist-v3?action=assets"),
        fetch("/api/checklist-v3?action=history"),
      ]);
      const [checklistPayload, catalogPayload, assetPayload, historyPayload] = await Promise.all([
        checklistResponse.json(),
        catalogResponse.json(),
        assetResponse.json(),
        historyResponse.json(),
      ]);
      if (!checklistResponse.ok) throw new Error(checklistPayload.error || "Erreur de chargement.");
      setBootstrap({ loading: false, payload: checklistPayload.data, error: "" });
      setCatalog(catalogPayload.data || null);
      setAssetAudit(assetPayload.data || null);
      setHistory(historyPayload.data || []);
    } catch (error) {
      setBootstrap({ loading: false, payload: null, error: error.message });
    }
  }

  useEffect(() => {
    refreshSession().then((authenticated) => {
      if (authenticated) loadAdminData();
    });
  }, []);

  const entries = bootstrap.payload?.entries || [];
  const summary = bootstrap.payload?.summary || {};
  const filtered = useMemo(
    () =>
      entries.filter((entry) =>
        [entry.name, entry.dexId, entry.form, entry.kind, entry.file, entry.primaryType]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [entries, search],
  );
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;
  const compareLeft = entries.find((entry) => entry.key === compareA);
  const compareRight = entries.find((entry) => entry.key === compareB);
  const bulkEntries = filtered.filter((entry) => !bulkOnlyIssues || entry.issues.length).slice(0, 80);
  const unchecked = entries.filter((entry) => !assetChecks[entry.key]);
  const assetItems = useMemo(() => {
    const lists = [
      ...(assetTab === "all" || assetTab === "proposals"
        ? (assetAudit?.proposals || []).map((item) => ({ ...item, group: "Propositions HD", image: item.url }))
        : []),
      ...(assetTab === "all" || assetTab === "go"
        ? (assetAudit?.goAssets || []).map((item) => ({ ...item, group: "Assets liés GO", image: item.url }))
        : []),
      ...(assetTab === "all" || assetTab === "shuffle"
        ? (assetAudit?.shuffleAssets || []).map((item) => ({ ...item, group: "Shuffle", image: item.url }))
        : []),
      ...(assetTab === "all" || assetTab === "unused"
        ? (assetAudit?.unused || []).map((item) => ({ ...item, group: "HD non utilisés", image: item.url }))
        : []),
    ];
    const needle = search.trim().toLowerCase();
    if (!needle) return lists;
    return lists.filter((item) => JSON.stringify(item).toLowerCase().includes(needle));
  }, [assetAudit, assetTab, search]);
  const exportPayload = {
    generatedAt: new Date().toISOString(),
    filters: { search },
    entries: filtered.slice(0, 250),
  };

  async function login() {
    setAuthError("");
    setSession((current) => ({ ...current, loading: true }));
    const response = await fetch("/api/checklist-v3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setSession({ loading: false, authenticated: false });
      setAuthError(payload.error || "Connexion refusée.");
      return;
    }
    setSession({ loading: false, authenticated: true });
    setPassword("");
    setActive("overview");
    await loadAdminData();
  }

  async function logout() {
    await fetch("/api/checklist-v3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setSession({ loading: false, authenticated: false });
    setBootstrap({ loading: false, payload: null, error: "" });
    setSelectedIndex(-1);
  }

  async function openDetail(entry) {
    const index = filtered.findIndex((item) => item.key === entry.key);
    setSelectedIndex(index);
    setExtraPanel(null);
    setDetail(null);
    const response = await fetch(`/api/checklist-v3?action=detail&key=${encodeURIComponent(entry.key)}`);
    const payload = await response.json();
    setDetail(response.ok ? payload.data : { detail: { error: payload.error || "Erreur de chargement." } });
  }

  function shiftDetail(delta) {
    if (!filtered.length) return;
    const nextIndex = (selectedIndex + delta + filtered.length) % filtered.length;
    openDetail(filtered[nextIndex]);
  }

  function setAssetChecked(key, checked) {
    const next = { ...assetChecks, [key]: checked };
    if (!checked) delete next[key];
    setAssetChecks(next);
    localStorage.setItem(assetChecksKey, JSON.stringify(next));
  }

  async function loadSources() {
    setSourceWatch({ loading: true, sources: [] });
    const response = await fetch("/api/checklist-v3?action=source-watch");
    const payload = await response.json();
    setSourceWatch(response.ok ? payload.data : { error: payload.error });
  }

  function addTodo() {
    if (!newTodo.trim()) return;
    const next = [{ id: Date.now(), text: newTodo.trim(), done: false }, ...todos];
    setTodos(next);
    setNewTodo("");
    localStorage.setItem(todoKey, JSON.stringify(next));
  }

  if (session.loading && !session.authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,.28),transparent_35%),#060914] p-4 text-white">
        <section className={panelClass}>
          <h2 className="text-xl font-black">Vérification de la session admin...</h2>
        </section>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_18%_0%,rgba(14,165,233,.32),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(34,197,94,.22),transparent_28%),#050815] p-4 text-white">
        <LoginCard
          password={password}
          error={authError}
          loading={session.loading}
          onPasswordChange={setPassword}
          onSubmit={login}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_0%,rgba(14,165,233,.28),transparent_30%),radial-gradient(circle_at_95%_8%,rgba(168,85,247,.24),transparent_28%),#050816] text-white">
      <div className="mx-auto flex w-full max-w-[1680px] gap-5 p-3 sm:p-5 lg:p-6">
        <aside className="sticky top-6 hidden h-[calc(100dvh-3rem)] w-72 shrink-0 flex-col rounded-[2rem] border border-white/10 bg-black/35 p-4 shadow-[0_30px_110px_rgba(0,0,0,.45)] backdrop-blur-2xl lg:flex">
          <div className="mb-6 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.055] p-3">
            <span className="relative h-12 w-12 overflow-hidden rounded-full bg-white shadow-inner before:absolute before:left-0 before:right-0 before:top-0 before:h-1/2 before:bg-red-500 after:absolute after:left-1/2 after:top-1/2 after:h-5 after:w-5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border-4 after:border-slate-900 after:bg-white" />
            <span>
              <strong className="block font-black">Admin Studio</strong>
              <small className="font-bold text-emerald-200">Session sécurisée</small>
            </span>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-1">
            {navItems.map(([id, label, Icon]) => (
              <button
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                  active === id
                    ? "bg-gradient-to-r from-sky-500 to-cyan-400 text-white shadow-[0_14px_45px_rgba(14,165,233,.25)]"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                key={id}
                type="button"
                onClick={() => setActive(id)}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <button className={`${buttonClass} mt-4 w-full`} type="button" onClick={logout}>
            <LogOut size={17} /> Déconnexion
          </button>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_24px_90px_rgba(0,0,0,.25)] backdrop-blur-2xl sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="mb-1 text-xs font-black uppercase tracking-[0.24em] text-cyan-200/70">
                  Dashboard sécurisé
                </p>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  {navItems.find(([id]) => id === active)?.[1]}
                </h1>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:w-[620px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    className={`${fieldClass} pl-11`}
                    placeholder="Chercher fiche, type, fichier..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <button className={buttonClass} type="button" onClick={loadAdminData}>
                  <RefreshCcw size={17} /> Actualiser
                </button>
              </div>
            </div>
            <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
              {navItems.map(([id, label, Icon]) => (
                <button
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black ${
                    active === id
                      ? "border-cyan-200/50 bg-cyan-400/20 text-cyan-50"
                      : "border-white/10 bg-white/[0.055] text-slate-300"
                  }`}
                  key={id}
                  type="button"
                  onClick={() => setActive(id)}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-sm font-black text-slate-300" type="button" onClick={logout}>
                <LogOut size={16} /> Sortir
              </button>
            </nav>
          </header>

          <div className="mt-5 space-y-5">
            {bootstrap.loading ? (
              <Panel title="Chargement du dashboard">
                <p className="font-bold text-slate-300">Je recharge les fiches, catalogues, assets et l’historique Git.</p>
              </Panel>
            ) : bootstrap.error ? (
              <Panel title="Erreur dashboard">
                <p className="font-bold text-red-100">{bootstrap.error}</p>
              </Panel>
            ) : null}

            {!bootstrap.loading && !bootstrap.error && active === "overview" ? (
              <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Fiches analysées" value={summary.total || 0} />
                  <MetricCard label="Terminées" value={summary.complete || 0} accent="green" />
                  <MetricCard label="Problèmes" value={summary.issues || 0} accent="amber" />
                  <MetricCard label="Assets vérifiés" value={Object.keys(assetChecks).length} accent="violet" />
                </section>

                <section className="grid gap-3 lg:grid-cols-3">
                  <article className="rounded-[2rem] border border-emerald-300/15 bg-emerald-400/10 p-5">
                    <Sparkles className="mb-4 text-emerald-200" size={24} />
                    <span className="text-sm font-bold text-emerald-100/80">Données complètes</span>
                    <strong className="mt-1 block text-3xl font-black">{summary.complete || 0}</strong>
                  </article>
                  <article className="rounded-[2rem] border border-cyan-300/15 bg-cyan-400/10 p-5">
                    <ShieldCheck className="mb-4 text-cyan-200" size={24} />
                    <span className="text-sm font-bold text-cyan-100/80">Accès admin</span>
                    <strong className="mt-1 block text-3xl font-black">Protégé</strong>
                  </article>
                  <article className="rounded-[2rem] border border-violet-300/15 bg-violet-400/10 p-5">
                    <BarChart3 className="mb-4 text-violet-200" size={24} />
                    <span className="text-sm font-bold text-violet-100/80">Résultat filtre</span>
                    <strong className="mt-1 block text-3xl font-black">{filtered.length}</strong>
                  </article>
                </section>

                <section className="grid gap-5 xl:grid-cols-2">
                  <Panel title="Complétion JSON par génération">
                    <CompletionList items={summary.generations || []} />
                  </Panel>
                  <Panel title="Problèmes par catégorie">
                    <BarList items={summary.categories || []} />
                  </Panel>
                  <Panel title="Historique Git" action={<History className="text-cyan-200" size={22} />}>
                    <HistoryList history={history} />
                  </Panel>
                  <Panel title="Fiches à surveiller">
                    <MiniCardList entries={[...entries].filter((entry) => entry.issues.length).slice(0, 8)} onOpen={openDetail} />
                  </Panel>
                </section>
              </>
            ) : null}

            {active === "pokedex" ? (
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filtered.slice(0, 240).map((entry) => (
                  <PokemonCard
                    admin
                    key={entry.key}
                    entry={entry}
                    onOpen={openDetail}
                    actionLabel="Ouvrir"
                    assetChecked={Boolean(assetChecks[entry.key])}
                    onAssetChecked={setAssetChecked}
                    typeCatalog={catalog?.types}
                    weatherCatalog={catalog?.weather}
                  />
                ))}
              </section>
            ) : null}

            {active === "assets" ? (
              <section className="grid gap-5 xl:grid-cols-[1.4fr_.9fr]">
                <Panel title="Vérification d’assets" eyebrow="bibliothèque">
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="GO" value={assetAudit?.totals?.goFiles || 0} />
                    <MetricCard label="Shuffle" value={assetAudit?.totals?.shuffleFiles || 0} accent="violet" />
                    <MetricCard label="Utilisés" value={assetAudit?.totals?.used || 0} accent="green" />
                    <MetricCard label="Doublons" value={assetAudit?.totals?.duplicated || 0} accent="amber" />
                  </div>
                  <p className="mb-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm font-bold leading-6 text-slate-300">
                    Cette page sert à contrôler les images réellement liées aux fiches et les propositions HD. La recherche globale filtre aussi cette liste.
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {[
                      ["all", "Tout"],
                      ["proposals", "Propositions HD"],
                      ["go", "Liés GO"],
                      ["shuffle", "Shuffle"],
                      ["unused", "HD non utilisés"],
                    ].map(([id, label]) => (
                      <button
                        className={`rounded-full border px-4 py-2 text-xs font-black ${
                          assetTab === id
                            ? "border-cyan-200/50 bg-cyan-400/20 text-cyan-50"
                            : "border-white/10 bg-white/[0.055] text-slate-300"
                        }`}
                        key={id}
                        type="button"
                        onClick={() => setAssetTab(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {assetItems.slice(0, 120).map((asset, index) => (
                      <article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40" key={`${asset.group}-${asset.filename || asset.url}-${index}`}>
                        <div className="grid aspect-square place-items-center bg-white/[0.04] p-3">
                          <img className="max-h-full object-contain" src={asset.image || asset.url} alt={asset.filename || asset.label || "asset"} />
                        </div>
                        <div className="border-t border-white/10 p-3">
                          <strong className="block truncate text-xs font-black text-white">{asset.filename || asset.label}</strong>
                          <span className="mt-1 block truncate text-xs font-bold text-slate-400">{asset.group} · {asset.label || asset.details || asset.form || "standard"}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </Panel>
                <Panel title="Fiches à vérifier" eyebrow={`${unchecked.length} restantes`}>
                  <MiniCardList entries={unchecked.slice(0, 50)} onOpen={openDetail} />
                </Panel>
              </section>
            ) : null}

            {active === "sources" ? (
              <Panel
                title="Veille sources"
                eyebrow="PokeMiners, Game Master, Shuffle"
                action={
                  <button className={primaryButtonClass} type="button" onClick={loadSources}>
                    <Radar size={17} /> Vérifier maintenant
                  </button>
                }
              >
                <SourceRows sourceWatch={sourceWatch} />
              </Panel>
            ) : null}

            {active === "catalogs" ? <CatalogPanel catalog={catalog} search={search} /> : null}

            {active === "compare" ? (
              <Panel title="Comparaison de fiches" eyebrow="contrôle">
                <p className="mb-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm font-bold leading-6 text-slate-300">
                  Compare deux fiches côte à côte pour vérifier rapidement les assets, types, problèmes JSON et informations visibles avant une correction.
                </p>
                <div className="mb-5 grid gap-3 md:grid-cols-2">
                  <select className={fieldClass} value={compareA} onChange={(event) => setCompareA(event.target.value)}>
                    <option value="">Fiche gauche</option>
                    {entries.slice(0, 1000).map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.dexId} · {entry.name}
                      </option>
                    ))}
                  </select>
                  <select className={fieldClass} value={compareB} onChange={(event) => setCompareB(event.target.value)}>
                    <option value="">Fiche droite</option>
                    {entries.slice(0, 1000).map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.dexId} · {entry.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {[compareLeft, compareRight].map((entry, index) => (
                    <div className="rounded-[2rem] border border-white/10 bg-slate-950/30 p-3" key={index}>
                      {entry ? (
                        <PokemonCard entry={entry} typeCatalog={catalog?.types} weatherCatalog={catalog?.weather} onOpen={openDetail} />
                      ) : (
                        <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm font-bold text-slate-400">Sélectionne une fiche.</p>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}

            {active === "bulk" ? (
              <Panel
                title="Corrections groupées"
                action={
                  <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white">
                    <input
                      className="h-5 w-5 accent-cyan-400"
                      type="checkbox"
                      checked={bulkOnlyIssues}
                      onChange={(event) => setBulkOnlyIssues(event.target.checked)}
                    />
                    Seulement les fiches avec problèmes
                  </label>
                }
              >
                <p className="mb-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm font-bold leading-6 text-slate-300">
                  Génère un brouillon JSON à partir des problèmes détectés. Ce panneau ne modifie pas les fichiers: il sert à préparer des corrections groupées.
                </p>
                <textarea className={`${fieldClass} min-h-[520px] resize-y font-mono text-xs leading-6`} readOnly value={JSON.stringify(Object.fromEntries(bulkEntries.map((entry) => [entry.key, entry.suggestedPatch])), null, 2)} />
              </Panel>
            ) : null}

            {active === "export" ? (
              <Panel
                title="Export et partage"
                action={
                  <button className={primaryButtonClass} type="button" onClick={() => copyToClipboard(exportPayload)}>
                    <Copy size={17} /> Copier l’export
                  </button>
                }
              >
                <p className="mb-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm font-bold leading-6 text-slate-300">
                  Exporte les fiches correspondant à la recherche globale en cours. Pratique pour partager un lot réduit ou conserver un état de contrôle.
                </p>
                <textarea className={`${fieldClass} min-h-[520px] resize-y font-mono text-xs leading-6`} readOnly value={JSON.stringify(exportPayload, null, 2)} />
              </Panel>
            ) : null}

            {active === "todo" ? (
              <Panel title="Todo-list">
                <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input className={fieldClass} value={newTodo} placeholder="Ajouter une tâche" onChange={(event) => setNewTodo(event.target.value)} />
                  <button className={primaryButtonClass} type="button" onClick={addTodo}>Ajouter</button>
                </div>
                <div className="grid gap-3">
                  {todos.map((todo) => (
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4" key={todo.id}>
                      <input
                        className="h-6 w-6 accent-cyan-400"
                        type="checkbox"
                        checked={todo.done}
                        onChange={(event) => {
                          const next = todos.map((item) => (item.id === todo.id ? { ...item, done: event.target.checked } : item));
                          setTodos(next);
                          localStorage.setItem(todoKey, JSON.stringify(next));
                        }}
                      />
                      <span className={`font-bold ${todo.done ? "text-slate-500 line-through" : "text-white"}`}>{todo.text}</span>
                    </label>
                  ))}
                </div>
              </Panel>
            ) : null}

            {active === "editor" ? (
              <Panel title="Éditeur de texte" eyebrow="notes privées">
                <textarea
                  className={`${fieldClass} min-h-[620px] resize-y font-mono text-sm leading-7`}
                  value={editorText}
                  onChange={(event) => {
                    setEditorText(event.target.value);
                    localStorage.setItem(editorKey, event.target.value);
                  }}
                  placeholder="Notes, brouillons JSON, idées de corrections..."
                />
              </Panel>
            ) : null}

            {active === "account" ? (
              <section className="grid gap-5 xl:grid-cols-2">
                <Panel title="Profil admin" eyebrow="configuration">
                  <div className="grid gap-3">
                    <input className={fieldClass} placeholder="Email administrateur" />
                    <input className={fieldClass} type="password" placeholder="Nouveau mot de passe" />
                    <input className={fieldClass} type="password" placeholder="Confirmation" />
                    <button className={primaryButtonClass} type="button" onClick={() => copyToClipboard("ADMIN_DASHBOARD_PASSWORD=<nouveau-secret>")}>
                      Préparer la variable Vercel
                    </button>
                  </div>
                </Panel>
                <Panel title="Sécurité" eyebrow="état">
                  <div className="grid gap-3">
                    {["Session httpOnly", "Actions admin protégées", "Routes sources bloquées", "Mot de passe en variable Vercel"].map((item) => (
                      <span className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 font-black text-emerald-100" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </Panel>
              </section>
            ) : null}
          </div>
        </section>
      </div>

      <DetailModal
        open={Boolean(selected)}
        entry={selected}
        detail={detail}
        mode="admin"
        typeCatalog={catalog?.types}
        weatherCatalog={catalog?.weather}
        extraPanel={extraPanel}
        onPrevious={() => shiftDetail(-1)}
        onNext={() => shiftDetail(1)}
        onClose={() => {
          setSelectedIndex(-1);
          setDetail(null);
          setExtraPanel(null);
        }}
        onCopyPatch={() => copyToClipboard(selected?.suggestedPatch || {})}
        onAuditUrls={async () => {
          const response = await fetch(`/api/checklist-v3?action=url-audit&key=${encodeURIComponent(selected.key)}`);
          const payload = await response.json();
          setExtraPanel(
            <div className="space-y-3">
              {(payload.data || []).map((item) => (
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3" key={item.url}>
                  <strong className={item.ok ? "text-emerald-200" : "text-red-200"}>{item.ok ? "Accessible" : "Erreur"}</strong>
                  <span className="mt-1 block break-all text-xs font-bold text-slate-300">
                    HTTP {item.status || "?"} · {item.url}
                  </span>
                </div>
              ))}
            </div>,
          );
        }}
        onAssetAudit={async () => {
          const response = await fetch(`/api/checklist-v3?action=assets&dexId=${encodeURIComponent(selected.dexId)}`);
          const payload = await response.json();
          const groups = [
            ["Propositions HD", payload.data?.proposals || []],
            ["Assets liés GO", payload.data?.goAssets || []],
            ["Shuffle", payload.data?.shuffleAssets || []],
          ];
          setExtraPanel(
            <div className="space-y-4">
              {groups.map(([label, items]) => (
                <section key={label}>
                  <div className="mb-2 flex items-center justify-between">
                    <strong className="text-white">{label}</strong>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-black text-slate-300">{items.length}</span>
                  </div>
                  {items.length ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {items.slice(0, 24).map((asset, index) => (
                        <article className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40" key={`${label}-${asset.filename || asset.url}-${index}`}>
                          <div className="grid aspect-square place-items-center p-3">
                            <img className="max-h-full object-contain" src={asset.url} alt={asset.filename || asset.label || label} />
                          </div>
                          <div className="border-t border-white/10 p-2">
                            <strong className="block truncate text-xs text-white">{asset.filename || asset.label}</strong>
                            <span className="mt-1 block truncate text-xs text-slate-400">{asset.details || asset.form || asset.state || "standard"}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-white/15 p-3 text-sm font-bold text-slate-400">Aucun résultat.</p>
                  )}
                </section>
              ))}
            </div>,
          );
        }}
      />
    </main>
  );
}
