"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { ApiStatusPill } from "./api-status-pill";
import { uiAssets } from "./ui-assets";

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
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white shadow-[0_0_0_5px_rgba(255,255,255,0.06)] ${
        small ? "h-8 w-8" : "h-10 w-10"
      }`}
      aria-hidden="true"
    >
      <img className="h-4/5 w-4/5 object-contain" src={uiAssets.icons.pokedex} alt="" />
    </span>
  );
}

export { PokeballMark };

export function SiteShell({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen text-slate-100">
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
                  Checklist, assets et données
                </small>
              </span>
            </Link>
            <nav className="hidden gap-2 lg:flex lg:justify-center" aria-label="Navigation principale">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl border border-transparent bg-transparent px-3 py-2 text-center text-sm font-bold text-slate-300 transition hover:border-cyan-200/35 hover:bg-cyan-400/10 hover:text-white"
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
            >
              {open ? <X size={18} /> : <Menu size={18} />}
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
                    className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-slate-200"
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
      {children}
    </div>
  );
}
