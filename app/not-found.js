import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,.28),transparent_35%),#060914] p-4 text-white">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_90px_rgba(0,0,0,.3)] backdrop-blur-2xl">
        <span className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/70">404</span>
        <h1 className="mt-2 text-3xl font-black">Page introuvable</h1>
        <p className="mt-3 font-bold text-slate-300">
          La ressource demandée n’existe pas ou n’est plus disponible dans cette
          version du studio.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-black text-white" href="/">
            Retour à l’accueil
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.075] px-4 text-sm font-black text-white" href="/checklist">
            Ouvrir la checklist
          </Link>
        </div>
      </section>
    </main>
  );
}
