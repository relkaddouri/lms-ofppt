import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import DefinirMotDePasseForm from "./DefinirMotDePasseForm";

export const metadata = { title: "Définir votre mot de passe" };

export default async function DefinirMotDePassePage() {
  // Le lien d'invitation ouvre déjà une session : sans elle, la page n'a rien
  // à faire.
  const user = await getUser();
  if (!user) redirect("/login");

  return <DefinirMotDePasseForm email={user.email ?? ""} />;
}
