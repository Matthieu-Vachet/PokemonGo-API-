import Link from "next/link";

export function SectionCard({ eyebrow, title, description, href, cta }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <span className="text-xs font-black uppercase tracking-wide text-sky-300">
        {eyebrow}
      </span>
      <h2 className="mt-2 text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      <Link className="mt-4 inline-flex font-black text-sky-300" href={href}>
        {cta}
      </Link>
    </article>
  );
}
