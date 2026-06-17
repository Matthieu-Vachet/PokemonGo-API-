import Link from "next/link";

export function SectionCard({ eyebrow, title, description, href, cta }) {
  return (
    <article className="surface section-card">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="text-link" href={href}>
        {cta}
      </Link>
    </article>
  );
}
