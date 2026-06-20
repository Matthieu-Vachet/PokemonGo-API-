import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin migré | Pokémon GO API Studio",
};

export default function AdminPage() {
  redirect("/");
}
