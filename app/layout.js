import "./globals.css";
import { SiteShell } from "../components/site/shell";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pokemon-go-api.vercel.app";
const siteName = "Pokémon GO API";
const description =
  "Pokédex Pokémon GO public en lecture seule, checklist JSON, bibliothèques d'assets et documentation OpenAPI.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: `${siteName} - Pokédex, assets et API publique`,
    template: `%s | ${siteName}`,
  },
  description,
  keywords: [
    "Pokémon GO API",
    "Pokédex Pokémon GO",
    "assets Pokémon GO",
    "OpenAPI Pokémon GO",
    "checklist JSON Pokémon GO",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName,
    title: `${siteName} - Pokédex et API publique`,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} - Pokédex et API publique`,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  colorScheme: "dark",
  themeColor: "#06111f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
