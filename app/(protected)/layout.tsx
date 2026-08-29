import { getUser, getCurrentUserRole } from "@/lib/supabase/server";
import { getCompteurNotifications } from "@/app/actions/dashboard";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getCurrentUserRole();

  // Un stagiaire n'a rien à faire dans l'espace formateur : les policies lui
  // rendraient des pages vides, ce qui ressemble à une panne. Il est renvoyé
  // vers le sien.
  if (role === "stagiaire") {
    redirect("/espace-stagiaire/fil");
  }

  const notifications = await getCompteurNotifications();

  return (
    <AppShell
      email={user.email ?? null}
      role={role}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
