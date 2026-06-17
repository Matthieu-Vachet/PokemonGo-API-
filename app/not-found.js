import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="surface empty-state-card">
        <span className="eyebrow">404</span>
        <h1>Page introuvable</h1>
        <p>
          La ressource demandée n’existe pas ou n’est plus disponible dans cette
          version du studio.
        </p>
        <div className="action-row">
          <Link className="button primary" href="/">
            Retour à l’accueil
          </Link>
          <Link className="button" href="/checklist">
            Ouvrir la checklist
          </Link>
        </div>
      </section>
    </main>
  );
}
