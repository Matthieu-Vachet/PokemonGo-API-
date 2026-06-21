const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pokemon-go-api.vercel.app";

const staticRoutes = [
  ["", "daily", 1],
  ["/checklist", "daily", 0.9],
  ["/assets", "weekly", 0.8],
  ["/api-docs", "monthly", 0.7],
  ["/swagger", "monthly", 0.6],
];

export default function sitemap() {
  const now = new Date();
  return staticRoutes.map(([path, changeFrequency, priority]) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
