import "./globals.css";
import { SiteShell } from "../components/site/shell";

export const metadata = {
  title: "Pokémon GO API Studio",
  description:
    "Checklist publique, bibliothèques d’assets et dashboard administrateur sécurisé pour Pokémon GO API.",
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
