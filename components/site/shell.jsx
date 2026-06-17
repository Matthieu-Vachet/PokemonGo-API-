import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { ApiStatusPill } from "./api-status-pill";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/checklist", label: "Checklist" },
  { href: "/assets", label: "Assets" },
  { href: "/api-docs", label: "Documentation" },
  { href: "/swagger", label: "API interactive" },
  { href: "/api-docs.json", label: "OpenAPI" },
  { href: "/admin", label: "Admin" },
];

export function SiteShell({ children }) {
  return (
    <div className="site-frame">
      <header className="topbar">
        <Link href="/" className="brand-lockup">
          <div className="brand-mark">PG</div>
          <div>
            <strong>Pokémon GO API Studio</strong>
            <span>Checklist Next.js · lecture publique + admin protégé</span>
          </div>
        </Link>
        <nav className="topnav" aria-label="Navigation principale">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="topbar-tools">
          <ApiStatusPill />
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}
