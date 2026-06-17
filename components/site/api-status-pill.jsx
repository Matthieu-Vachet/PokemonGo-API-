"use client";

import { useEffect, useState } from "react";

export function ApiStatusPill() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    fetch("/health")
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setStatus(payload?.data?.status === "ok" ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs font-bold text-slate-300">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          status === "online"
            ? "bg-emerald-400"
            : status === "offline"
              ? "bg-rose-400"
              : "bg-amber-300"
        }`}
      />
      {status === "online"
        ? "API + DB connectées"
        : status === "offline"
          ? "API indisponible"
          : "Connexion..."}
    </span>
  );
}
