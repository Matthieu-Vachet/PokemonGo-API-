"use client";

import { useEffect, useState } from "react";

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
      className="min-h-10 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
      type="button"
      onClick={() => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
    >
      {theme === "dark" ? "Jour" : "Nuit"}
    </button>
  );
}
