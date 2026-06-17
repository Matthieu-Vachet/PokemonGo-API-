import { ChecklistApp } from "../../components/checklist/checklist-app";

export const metadata = {
  title: "Checklist publique | Pokémon GO API Studio",
};

export default function ChecklistPage() {
  return <ChecklistApp mode="public" />;
}
