export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,.28),transparent_35%),#060914] p-4 text-white">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_90px_rgba(0,0,0,.3)] backdrop-blur-2xl">
        <span className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/70">Chargement</span>
        <h1 className="mt-2 text-3xl font-black">On prépare le studio.</h1>
        <p className="mt-3 font-bold text-slate-300">Les données Pokémon GO arrivent, avec les métriques et les assets.</p>
      </section>
    </main>
  );
}
