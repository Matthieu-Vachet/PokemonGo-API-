const accents = {
  blue: "text-sky-300",
  cyan: "text-cyan-300",
  green: "text-emerald-300",
  amber: "text-amber-300",
  violet: "text-violet-300",
};

export function MetricCard({ label, value, accent = "blue", icon }) {
  return (
    <article
      className={`grid items-center gap-4 rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur md:p-5 ${
        icon ? "grid-cols-[auto_minmax(0,1fr)]" : ""
      }`}
    >
      {icon ? (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/35 p-2">
          <img className="max-h-full object-contain" src={icon} alt="" />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <strong
          className={`mt-2 block truncate text-3xl font-black leading-none md:text-4xl ${
            accents[accent] || accents.blue
          }`}
        >
          {value}
        </strong>
      </span>
    </article>
  );
}
