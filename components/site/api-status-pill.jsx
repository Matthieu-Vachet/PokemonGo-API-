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
    <span className={`status-pill ${status}`}>
      <span className="status-dot" />
      {status === "online"
        ? "API + DB connectées"
        : status === "offline"
          ? "API indisponible"
          : "Connexion..."}
    </span>
  );
}
