import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { ApiStatusPill } from "./api-status-pill";

const links = [
  { href: "/checklist", label: "Pokédex" },
  { href: "/assets", label: "Bibliothèques" },
  { href: "/api-docs", label: "Documentation" },
  { href: "/swagger", label: "API interactive" },
  { href: "/admin", label: "Dashboard" },
];

function PokeballMark({ small = false }) {
  return (
    <span
      className={`relative shrink-0 rounded-full border-2 border-zinc-950 bg-[linear-gradient(#ff4f5e_0_48%,#202633_49%_53%,#f8fafc_54%_100%)] shadow-[0_0_0_5px_rgba(255,255,255,0.06)] ${
        small ? "h-8 w-8" : "h-10 w-10"
      }`}
      aria-hidden="true"
    >
      <span className="absolute inset-[29%] rounded-full border-[3px] border-slate-800 bg-white" />
    </span>
  );
}

export { PokeballMark };

export function SiteShell({ children }) {
  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-30 grid gap-3 border-b border-white/10 bg-zinc-950/85 px-3 py-3 backdrop-blur-xl lg:grid-cols-[minmax(230px,auto)_1fr_auto] lg:items-center lg:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Accueil">
          <PokeballMark />
          <span className="min-w-0">
            <strong className="block truncate text-sm font-black md:text-base">
              Pokémon GO API
            </strong>
            <small className="block truncate text-xs font-semibold text-slate-400">
              Checklist, assets et données
            </small>
          </span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto lg:justify-center" aria-label="Navigation principale">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg border border-transparent px-3 py-2 text-sm font-bold text-slate-300 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <ApiStatusPill />
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}
