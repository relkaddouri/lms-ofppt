import { getUser, getCurrentUserRole } from "@/lib/supabase/server";
import { getNotifications } from "@/app/actions/notifications";
import { getAnneeCourante, getAnneesScolaires } from "@/app/actions/annees";
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

  // Le compte vient de la liste elle-même, et non d'un second calcul : les
  // deux divergeaient — la pastille disait 7 pendant que le panneau en listait
  // 19 — et la cloche, qui relit toutes les 45 secondes, faisait sauter le
  // chiffre une seconde après chaque chargement de page.
  const [notifications, annees, courante] = await Promise.all([
    getNotifications().then((n) => n.length),
    getAnneesScolaires(),
    getAnneeCourante(),
  ]);

  return (
    <AppShell
      email={user.email ?? null}
      role={role}
      notifications={notifications}
      annees={annees}
      anneeCouranteId={courante?.id ?? null}
    >
      {children}
    </AppShell>
  );
}
