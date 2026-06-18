export function LoginCard({ password, error, loading, onPasswordChange, onSubmit }) {
  return (
    <section className="w-full max-w-xl rounded-lg border border-white/10 bg-zinc-950/85 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
      <span className="text-xs font-black uppercase tracking-wide text-sky-300">
        Accès administrateur
      </span>
      <h2 className="mt-2 text-3xl font-black">Connexion sécurisée</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Le dashboard admin débloque les audits, la lecture source, les patches et
        les outils de contrôle avancés.
      </p>
      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          className="min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-300"
          type="password"
          value={password}
          placeholder="Mot de passe admin"
          onChange={(event) => onPasswordChange(event.target.value)}
        />
        <button
          className="min-h-11 rounded-lg border border-cyan-200/30 bg-cyan-400/15 px-4 font-black text-cyan-50 transition hover:bg-cyan-400/20 disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm font-bold text-rose-300">{error}</p> : null}
    </section>
  );
}
