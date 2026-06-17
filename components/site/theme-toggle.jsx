"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const storageKey = "pgapi-theme-v2";

function applyTheme(nextTheme) {
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(storageKey, nextTheme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const nextTheme = saved === "light" || saved === "dark" ? saved : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  return (
    <button
      className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] p-1 text-xs font-black text-slate-200 shadow-inner transition hover:border-cyan-200/45 hover:bg-white/10"
      type="button"
      aria-label={theme === "dark" ? "Passer en mode jour" : "Passer en mode nuit"}
      aria-pressed={theme === "dark"}
      onClick={() => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-full transition ${
          theme === "light"
            ? "bg-amber-300 text-slate-950 shadow-[0_8px_24px_rgba(251,191,36,.28)]"
            : "text-slate-400"
        }`}
      >
        <Sun size={16} />
      </span>
      <span
        className={`grid h-9 w-9 place-items-center rounded-full transition ${
          theme === "dark"
            ? "bg-gradient-to-br from-sky-400 to-violet-500 text-white shadow-[0_8px_24px_rgba(14,165,233,.25)]"
            : "text-slate-500"
        }`}
      >
        <Moon size={16} />
      </span>
    </button>
  );
}
