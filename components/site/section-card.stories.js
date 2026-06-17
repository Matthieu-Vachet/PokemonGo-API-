import { SectionCard } from "./section-card";

export default {
  title: "Site/SectionCard",
  component: SectionCard,
  tags: ["autodocs"],
};

export const Default = {
  args: {
    eyebrow: "Visiteurs",
    title: "Checklist publique",
    description:
      "Toutes les fiches Pokémon, les détails et les bibliothèques d’assets en lecture seule.",
    href: "/checklist",
    cta: "Ouvrir",
  },
};
