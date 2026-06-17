"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "../site/metric-card";
import { PokemonCard } from "../checklist/pokemon-card";
import { DetailModal } from "../checklist/detail-modal";
import { LoginCard } from "./login-card";

export function AdminApp() {
  const [session, setSession] = useState({ loading: true, authenticated: false });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [bootstrap, setBootstrap] = useState({ loading: false, payload: null, error: "" });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [extraPanel, setExtraPanel] = useState(null);
  const [search, setSearch] = useState("");

  async function refreshSession() {
    const response = await fetch("/api/checklist-v3?action=session");
    const payload = await response.json();
    setSession({ loading: false, authenticated: Boolean(payload.data?.authenticated) });
    return Boolean(payload.data?.authenticated);
  }

  async function loadAdminData() {
    setBootstrap((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/api/checklist-v3");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Erreur de chargement.");
      setBootstrap({ loading: false, payload: payload.data, error: "" });
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
  const filtered = useMemo(
    () =>
      entries.filter((entry) =>
        `${entry.name} ${entry.dexId} ${entry.form} ${entry.file}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [entries, search],
  );

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
    setSelected(null);
  }

  async function openDetail(entry) {
    setSelected(entry);
    setExtraPanel(null);
    const response = await fetch(
      `/api/checklist-v3?action=detail&key=${encodeURIComponent(entry.key)}`,
    );
    const payload = await response.json();
    if (!response.ok) {
      setDetail({ detail: { error: payload.error || "Erreur de chargement." } });
      return;
    }
    setDetail(payload.data);
  }

  if (session.loading && !session.authenticated) {
    return (
      <main className="page-shell">
        <section className="surface loading-panel">
          <h2>Vérification de la session admin...</h2>
        </section>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <main className="page-shell">
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
    <main className="page-shell">
      <section className="surface hero-subpage">
        <span className="eyebrow">Dashboard admin</span>
        <h1>Atelier de contrôle sécurisé</h1>
        <p className="lede">
          Les outils sensibles vivent ici: lecture détaillée, patches suggérés,
          audits d’assets, contrôle d’URLs et analyse qualité.
        </p>
        <div className="action-row">
          <button className="button" type="button" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </section>

      {bootstrap.loading ? (
        <section className="surface loading-panel">
          <h2>Chargement du dashboard...</h2>
        </section>
      ) : bootstrap.error ? (
        <section className="surface empty-state-card">
          <h2>Impossible de charger les données admin</h2>
          <p>{bootstrap.error}</p>
        </section>
      ) : (
        <>
          <section className="metrics-grid">
            <MetricCard label="Fiches" value={bootstrap.payload?.summary?.total || 0} />
            <MetricCard
              label="Terminées"
              value={bootstrap.payload?.summary?.complete || 0}
              accent="green"
            />
            <MetricCard
              label="Problèmes"
              value={bootstrap.payload?.summary?.issues || 0}
              accent="amber"
            />
            <MetricCard label="En vue" value={filtered.length} accent="violet" />
          </section>

          <section className="surface filter-bar">
            <input
              className="field"
              placeholder="Chercher une fiche, un dexId ou un fichier source"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </section>

          <section className="card-grid">
            {filtered.map((entry) => (
              <PokemonCard
                key={entry.key}
                entry={entry}
                onOpen={openDetail}
                actionLabel="Ouvrir l’atelier"
              />
            ))}
          </section>
        </>
      )}

      <DetailModal
        open={Boolean(selected)}
        entry={selected}
        detail={detail}
        mode="admin"
        extraPanel={extraPanel}
        onClose={() => {
          setSelected(null);
          setDetail(null);
          setExtraPanel(null);
        }}
        onCopyPatch={() => {
          navigator.clipboard.writeText(
            JSON.stringify(selected?.suggestedPatch || {}, null, 2),
          );
        }}
        onAuditUrls={async () => {
          const response = await fetch(
            `/api/checklist-v3?action=url-audit&key=${encodeURIComponent(selected.key)}`,
          );
          const payload = await response.json();
          setExtraPanel(
            <div className="issue-list">
              {(payload.data || []).map((item) => (
                <div className="issue-item" key={item.url}>
                  <strong>{item.ok ? "Accessible" : "Erreur"}</strong>
                  <span>
                    HTTP {item.status || "?"} · {item.url}
                  </span>
                </div>
              ))}
            </div>,
          );
        }}
        onAssetAudit={async () => {
          const response = await fetch(
            `/api/checklist-v3?action=assets&dexId=${encodeURIComponent(selected.dexId)}`,
          );
          const payload = await response.json();
          setExtraPanel(
            <div className="kv-grid">
              <div>
                <span>GO</span>
                <strong>{payload.data?.totals?.goFiles || 0}</strong>
              </div>
              <div>
                <span>Shuffle</span>
                <strong>{payload.data?.totals?.shuffleFiles || 0}</strong>
              </div>
              <div>
                <span>Propositions</span>
                <strong>{payload.data?.proposals?.length || 0}</strong>
              </div>
              <div>
                <span>GO liés</span>
                <strong>{payload.data?.goAssets?.length || 0}</strong>
              </div>
            </div>,
          );
        }}
      />
    </main>
  );
}
