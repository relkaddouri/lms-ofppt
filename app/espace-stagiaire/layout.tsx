import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getIdentiteStagiaire } from "@/app/actions/stagiaire";
import { NavigationHaute, NavigationBasse } from "./BarreNavigation";
import PhotoStagiaire from "@/components/PhotoStagiaire";
import ModaleDistinction from "@/components/ModaleDistinction";
import { signOutAction } from "@/app/actions/auth";
import { Bell, LogOut } from "lucide-react";

export default async function EspaceStagiaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  // Un formateur n'a rien à faire ici : il repart vers son propre espace
  // plutôt que de voir un fil vide.
  const identite = await getIdentiteStagiaire();
  if (!identite) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-paper">
      {/* Dans le gabarit et non sur une page : la fête doit s'ouvrir à
          l'arrivée, quel que soit l'écran par lequel le stagiaire entre. */}
      <ModaleDistinction />

      <header className="sticky top-0 z-30 border-b border-separator bg-surface">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 pb-3.5 pt-4 md:max-w-4xl md:gap-6 md:px-6 md:py-3">
          {/* Sa photo se change là où il se voit : l'en-tête est le seul
              endroit de son espace où il est représenté, et lui inventer un
              écran « Mon compte » pour un seul réglage aurait ajouté un
              cinquième onglet à une barre qui en tient quatre (§6). */}
          <PhotoStagiaire
            stagiaireId={identite.stagiaireId}
            prenom={identite.prenom}
            nom={identite.nom}
            photo={identite.photo}
            compact
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-display text-[16.5px] font-semibold text-ink md:text-sm">
              {identite.prenom} {identite.nom}
            </span>
            <span className="truncate font-mono text-[12.5px] text-slate-light md:text-xs">
              {identite.groupeNom}
              {identite.annee
                ? ` · ${identite.annee}${identite.annee === 1 ? "ʳᵉ" : "ᵉ"} année`
                : ""}
            </span>
          </span>

          <span className="ml-auto flex items-center gap-2">
            <NavigationHaute />

            {/* La cloche de la maquette : le panneau de notifications n'existe
                pas encore, le bouton reste donc visible et inerte plutôt
                qu'absent — il annonce ce qui vient. */}
            <button
              type="button"
              aria-label="Notifications"
              disabled
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-slate-2 md:hidden"
            >
              <Bell size={18} aria-hidden />
            </button>

            {/* La déconnexion tient dans l'en-tête : la barre du bas est
                réservée à la navigation, et un cinquième onglet la
                surchargerait. */}
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-[9px] text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink md:px-3"
              >
                <LogOut className="h-5 w-5 shrink-0" aria-hidden />
                <span className="hidden text-sm md:inline">Déconnexion</span>
              </button>
            </form>
          </span>
        </div>
      </header>

      {/* La marge basse dégage la barre fixe du mobile ; sur grand écran, la
          barre n'existe pas et la page respire. */}
      <main className="mx-auto max-w-lg pb-[86px] md:max-w-4xl md:px-6 md:pb-12 md:pt-6">
        {children}
      </main>

      <NavigationBasse />
    </div>
  );
}
