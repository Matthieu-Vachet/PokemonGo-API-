export function PokemonCard({
  entry,
  onOpen,
  actionLabel = "Voir la fiche",
  compact = false,
}) {
  const score = entry?.quality?.score ?? 0;
  const types = [entry.primaryType, entry.secondaryType].filter(Boolean);

  return (
    <article className={`pokemon-card ${compact ? "compact" : ""}`}>
      <div className="pokemon-card-head">
        <div className="pokemon-avatar">
          {entry.image ? <img src={entry.image} alt={entry.name} /> : <span>?</span>}
        </div>
        <div className="pokemon-meta">
          <span className="mono">N° {entry.dexId}</span>
          <h3>{entry.name}</h3>
          <p>
            {entry.form} · Gen. {entry.generation || "?"} · {entry.kind}
          </p>
        </div>
        <div className="score-chip">{score}%</div>
      </div>
      <div className="type-row">
        {types.map((type) => (
          <span className="type-pill" key={type}>
            {type}
          </span>
        ))}
      </div>
      <div className="mini-stats">
        <span>{entry.quickMoveCount} rapides</span>
        <span>{entry.chargedMoveCount} chargées</span>
        <span>{entry.issues.length} problèmes</span>
      </div>
      {onOpen ? (
        <button className="button primary full" type="button" onClick={() => onOpen(entry)}>
          {actionLabel}
        </button>
      ) : null}
    </article>
  );
}
