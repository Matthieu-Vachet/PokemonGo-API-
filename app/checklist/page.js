import { ChecklistApp } from "../../components/checklist/checklist-app";

export const metadata = {
  title: "Checklist publique | Pokémon GO API",
  description: "Parcours read-only des fiches Pokémon GO, filtres de formes, générations et statuts JSON.",
};

export default function ChecklistPage() {
  return <ChecklistApp />;
}
