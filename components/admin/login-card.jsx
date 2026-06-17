export function LoginCard({ password, error, loading, onPasswordChange, onSubmit }) {
  return (
    <section className="surface login-card">
      <span className="eyebrow">Accès administrateur</span>
      <h2>Connexion sécurisée</h2>
      <p>
        Le dashboard admin débloque les audits, la lecture source, les patches et
        les outils de contrôle avancés.
      </p>
      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          className="field"
          type="password"
          value={password}
          placeholder="Mot de passe admin"
          onChange={(event) => onPasswordChange(event.target.value)}
        />
        <button className="button primary" type="submit" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
