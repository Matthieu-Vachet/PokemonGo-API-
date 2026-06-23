"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { ApiStatusPill } from "./api-status-pill";
import { uiAssets } from "./ui-assets";

const links = [
  { href: "/bibliotheque", label: "Bibliothèque API" },
  { href: "/assets", label: "Bibliothèques" },
  { href: "/api-docs", label: "Documentation" },
  { href: "/swagger", label: "API interactive" },
];

function PokeballMark({ small = false }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white shadow-[0_0_0_5px_rgba(255,255,255,0.06)] ${
        small ? "h-8 w-8" : "h-10 w-10"
      }`}
      aria-hidden="true"
    >
      <img className="h-4/5 w-4/5 object-contain" src={uiAssets.icons.goLogo} alt="" />
    </span>
  );
}

export { PokeballMark };

export function SiteShell({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";

  function isActive(href) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen text-slate-100">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-2xl focus:bg-cyan-300 focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-slate-950"
        href="#contenu-principal"
      >
        Aller au contenu principal
      </a>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/86 px-3 py-3 shadow-[0_18px_80px_rgba(0,0,0,.22)] backdrop-blur-xl lg:px-6">
        <div className="mx-auto max-w-[1680px]">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[minmax(245px,auto)_1fr_auto]">
            <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Accueil" onClick={() => setOpen(false)}>
              <PokeballMark />
              <span className="min-w-0">
                <strong className="block truncate text-sm font-black md:text-base">
                  Pokémon GO API
                </strong>
                <small className="block truncate text-xs font-semibold text-slate-400">
                  Bibliothèque API et données
                </small>
              </span>
            </Link>
            <nav className="hidden gap-2 lg:flex lg:justify-center" aria-label="Navigation principale">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`rounded-2xl border px-3 py-2 text-center text-sm font-bold transition ${
                    isActive(link.href)
                      ? "border-cyan-200/45 bg-cyan-400/15 text-white"
                      : "border-transparent bg-transparent text-slate-300 hover:border-cyan-200/35 hover:bg-cyan-400/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="hidden flex-wrap items-center gap-2 lg:flex lg:justify-end">
              <ApiStatusPill />
              <ThemeToggle />
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white lg:hidden"
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-site-nav"
              aria-label={open ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation"}
            >
              {open ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
              Menu
            </button>
          </div>
          {open ? (
            <div id="mobile-site-nav" className="mt-3 rounded-[1.5rem] border border-white/10 bg-slate-950/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,.35)] lg:hidden">
              <nav className="grid gap-2" aria-label="Navigation mobile">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                      isActive(link.href)
                        ? "border-cyan-200/45 bg-cyan-400/15 text-white"
                        : "border-white/10 bg-white/[0.045] text-slate-200"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <ApiStatusPill />
                <ThemeToggle />
              </div>
            </div>
          ) : null}
        </div>
      </header>
      <div id="contenu-principal" tabIndex={-1}>
        {children}
      </div>
      <footer className="border-t border-white/10 bg-zinc-950/88 px-4 py-8 backdrop-blur-xl lg:px-6">
        <div className="mx-auto grid max-w-[1680px] gap-6 md:grid-cols-[1.1fr_.9fr_.9fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Accueil Pokémon GO API">
              <PokeballMark small />
              <span>
                <strong className="block text-sm font-black text-white">Pokémon GO API</strong>
                <small className="block text-xs font-bold text-slate-400">Données, assets et contrôle qualité.</small>
              </span>
            </Link>
            <p className="mt-3 max-w-md text-sm font-bold leading-6 text-slate-400">
              Un accès public en lecture seule pour explorer les données, les assets et les statistiques.
            </p>
          </div>
          <nav className="grid gap-2 text-sm font-bold text-slate-300" aria-label="Liens utiles footer">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Explorer</span>
            {links.slice(0, 4).map((link) => (
              <Link className="w-fit transition hover:text-cyan-200" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="space-y-3">
            <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">État API</span>
            <ApiStatusPill />
            <div className="flex flex-wrap gap-2 text-xs font-black text-slate-300">
              <Link className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 hover:bg-white/10" href="/health">
                Health
              </Link>
              <Link className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 hover:bg-white/10" href="/api-docs.json">
                OpenAPI JSON
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
