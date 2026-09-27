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
  // 19 — et la cloche faisait sauter le chiffre une seconde après chaque
  // chargement de page.
  //
  // Ce qui descend jusqu'à la cloche n'est pas un nombre mais un identifiant
  // et une date par notification : de quoi afficher la pastille et savoir ce
  // qui est nouveau, sans relire (audit du 26/09/2026, correction 4).
  const [notifications, annees, courante] = await Promise.all([
    getNotifications().then((liste) =>
      liste.map((n) => ({ id: n.id, date: n.date })),
    ),
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
