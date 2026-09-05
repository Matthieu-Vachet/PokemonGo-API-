import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  "https://cdn.redoc.ly",
  "https://unpkg.com",
];

if (process.env.NODE_ENV === "development") scriptSources.push("'unsafe-eval'");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https:",
      `script-src ${scriptSources.join(" ")}`,
      "connect-src 'self' https:",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const pokemonGoDataTrace = [
  "./runtime-data/PokemonGo-Data/package.json",
  "./runtime-data/PokemonGo-Data/version.json",
  "./runtime-data/PokemonGo-Data/.dashboard-data-snapshot.json",
  "./runtime-data/PokemonGo-Data/data/pokemon/**/*",
  "./runtime-data/PokemonGo-Data/data/assets/**/*",
  "./runtime-data/PokemonGo-Data/data/pvp/pokemon/**/*",
  "./runtime-data/PokemonGo-Data/data/pvp/manifests/**/*",
  "./runtime-data/PokemonGo-Data/data/moves/**/*",
  "./runtime-data/PokemonGo-Data/data/adventure-effects/**/*",
  "./runtime-data/PokemonGo-Data/data/reference/**/*",
  "./runtime-data/PokemonGo-Data/data/battles/raids/**/*",
  "./runtime-data/PokemonGo-Data/data/battles/max-battles/**/*",
  "./runtime-data/PokemonGo-Data/data/battles/rocket/**/*",
  "./runtime-data/PokemonGo-Data/data/activities/eggs/**/*",
  "./runtime-data/PokemonGo-Data/data/activities/research/**/*",
  "./runtime-data/PokemonGo-Data/mappings/**/*",
  "./runtime-data/PokemonGo-Data/tooling/**/*",
  "./runtime-data/PokemonGo-Data/schemas/**/*",
  "./runtime-data/PokemonGo-Data/operations/audits/**/*",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    "/*": pokemonGoDataTrace,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
