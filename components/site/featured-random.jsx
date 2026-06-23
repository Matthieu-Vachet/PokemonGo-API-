"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PokemonCard } from "../checklist/pokemon-card";

function pickRandom(entries, count = 4) {
  const pool = [...(entries || [])];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, count);
}

export function FeaturedRandom({ entries = [], fallback = [], typeCatalog = [], weatherCatalog = [] }) {
  const [featured, setFeatured] = useState(fallback.slice(0, 4));

  useEffect(() => {
    setFeatured(pickRandom(entries.length ? entries : fallback, 4));
  }, [entries, fallback]);

  if (!featured.length) {
    return (
      <div className="rounded-[2rem] border border-cyan-300/20 bg-cyan-400/10 p-5 text-cyan-100 lg:col-span-2">
        <Sparkles className="mb-3" size={24} />
        <strong className="block text-lg font-black">Les fiches apparaîtront ici au chargement du dataset.</strong>
        <span className="mt-1 block text-sm font-bold text-cyan-100/75">
          Le Pokédex complet reste disponible depuis la navigation principale.
        </span>
      </div>
    );
  }

  return featured.map((entry) => (
    <Link
      className="block transition hover:-translate-y-0.5"
      href={`/bibliotheque?search=${encodeURIComponent(entry.dexId || entry.name || "")}`}
      key={entry.key}
    >
      <PokemonCard entry={entry} typeCatalog={typeCatalog} weatherCatalog={weatherCatalog} />
    </Link>
  ));
}
