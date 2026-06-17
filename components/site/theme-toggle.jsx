"use client";

import { useEffect, useState } from "react";

const storageKey = "pgapi-theme";

function applyTheme(nextTheme) {
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(storageKey, nextTheme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const nextTheme =
      saved ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  return (
    <button
      className="button subtle"
      type="button"
      onClick={() => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
    >
      {theme === "dark" ? "Mode jour" : "Mode nuit"}
    </button>
  );
}
