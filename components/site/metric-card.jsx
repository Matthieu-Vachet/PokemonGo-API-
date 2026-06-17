const accents = {
  blue: "text-sky-300",
  cyan: "text-cyan-300",
  green: "text-emerald-300",
  amber: "text-amber-300",
  violet: "text-violet-300",
};

export function MetricCard({ label, value, accent = "blue" }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur md:p-5">
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <strong
        className={`mt-2 block text-3xl font-black leading-none md:text-4xl ${
          accents[accent] || accents.blue
        }`}
      >
        {value}
      </strong>
    </article>
  );
}
