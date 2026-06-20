import "./globals.css";
import { SiteShell } from "../components/site/shell";

export const metadata = {
  title: "Pokémon GO API Studio",
  description:
    "Checklist publique read-only, bibliothèques d’assets et API Pokémon GO.",
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
