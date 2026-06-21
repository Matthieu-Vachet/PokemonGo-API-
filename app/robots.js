const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pokemon-go-api.vercel.app";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/checklist", "/assets", "/api-docs", "/swagger", "/api/v1/"],
      disallow: [
        "/admin",
        "/api/checklist-v3?action=source-watch",
        "/api/checklist-v3?action=history",
        "/api/checklist-v3?action=url-audit",
        "/api/v1/meta/sync",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
