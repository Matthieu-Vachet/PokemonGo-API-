"use client";

export function DetailModal({
  open,
  entry,
  detail,
  mode = "public",
  onClose,
  onCopyPatch,
  onAuditUrls,
  onAssetAudit,
  extraPanel,
}) {
  if (!open || !entry) return null;

  const payload = detail?.detail || detail || {};
  const stats = payload.stats || entry.stats || {};
  const availability = payload.availability || entry.availability || {};

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div className="pokemon-avatar large">
            {entry.image ? <img src={entry.image} alt={entry.name} /> : <span>?</span>}
          </div>
          <div className="modal-title">
            <span className="mono">N° {entry.dexId}</span>
            <h2>{entry.name}</h2>
            <p>
              {entry.form} · {entry.kind} · Génération {entry.generation || "?"}
            </p>
          </div>
          <button className="close-button" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="detail-grid">
          {payload.error ? (
            <section className="surface inset">
              <h3>Erreur</h3>
              <p className="error-text">{payload.error}</p>
            </section>
          ) : null}
          <section className="surface inset">
            <h3>Vue d’ensemble</h3>
            <div className="kv-grid">
              <div>
                <span>Types</span>
                <strong>
                  {[entry.primaryType, entry.secondaryType].filter(Boolean).join(" / ") || "-"}
                </strong>
              </div>
              <div>
                <span>Boost météo</span>
                <strong>{(entry.weatherBoost || []).join(", ") || "-"}</strong>
              </div>
              <div>
                <span>Attaques</span>
                <strong>
                  {entry.quickMoveCount} rapides · {entry.chargedMoveCount} chargées
                </strong>
              </div>
              <div>
                <span>Score qualité</span>
                <strong>{entry.quality.score}%</strong>
              </div>
            </div>
          </section>

          <section className="surface inset">
            <h3>Statistiques</h3>
            <div className="kv-grid">
              <div>
                <span>Attaque</span>
                <strong>{stats.attack ?? "-"}</strong>
              </div>
              <div>
                <span>Défense</span>
                <strong>{stats.defense ?? "-"}</strong>
              </div>
              <div>
                <span>Endurance</span>
                <strong>{stats.stamina ?? "-"}</strong>
              </div>
              <div>
                <span>PC max 50</span>
                <strong>{payload.maxCp?.maxLevel50 ?? entry.maxCp?.maxLevel50 ?? "-"}</strong>
              </div>
            </div>
          </section>

          <section className="surface inset">
            <h3>Disponibilité</h3>
            <div className="tag-wrap">
              {Object.entries(availability).map(([key, value]) => (
                <span className={`flag-pill ${value ? "on" : "off"}`} key={key}>
                  {key}
                </span>
              ))}
            </div>
          </section>

          <section className="surface inset">
            <h3>Checklist</h3>
            <div className="issue-list">
              {(entry.issues || []).length ? (
                entry.issues.map((issue) => (
                  <div className="issue-item" key={`${issue.path}-${issue.issue}`}>
                    <strong>{issue.path}</strong>
                    <span>
                      {issue.issue} · attendu {issue.expected} · actuel {issue.actual}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-inline">Aucun problème détecté.</div>
              )}
            </div>
          </section>
        </div>

        {mode === "admin" ? (
          <section className="surface inset admin-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Admin</span>
                <h3>Outils de correction</h3>
              </div>
            </div>
            <div className="action-row">
              <button className="button primary" type="button" onClick={onCopyPatch}>
                Copier le patch suggéré
              </button>
              <button className="button" type="button" onClick={onAuditUrls}>
                Vérifier les URLs
              </button>
              <button className="button" type="button" onClick={onAssetAudit}>
                Audit des assets
              </button>
            </div>
            <textarea
              className="code-block"
              readOnly
              value={JSON.stringify(entry.suggestedPatch || {}, null, 2)}
            />
            {extraPanel}
          </section>
        ) : null}
      </div>
    </div>
  );
}
