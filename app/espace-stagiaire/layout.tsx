import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getIdentiteStagiaire } from "@/app/actions/stagiaire";
import { NavigationHaute, NavigationBasse } from "./BarreNavigation";
import PhotoStagiaire from "@/components/PhotoStagiaire";
import ModaleDistinction from "@/components/ModaleDistinction";
import ClocheStagiaire from "@/components/ClocheStagiaire";
import { signOutAction } from "@/app/actions/auth";
import { LogOut } from "lucide-react";

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
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 pb-3.5 pt-4 md:max-w-6xl md:gap-6 md:px-6 md:py-3 xl:max-w-[1440px]">
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
            retrait
            moi
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

            {/* La cloche mène au commentaire lui-même, pas à la page qui le
                contient : c'est tout l'objet de l'ancre posée sur chaque
                commentaire. Elle reste dans l'en-tête aux deux tailles — la
                barre du bas ne tient que la navigation (§6). */}
            <ClocheStagiaire />

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
      {identite.estTest ? (
        // Le formateur doit savoir, à chaque écran, qu'il n'est pas dans le
        // compte d'un vrai stagiaire.
        <div className="border-b border-tint-teal-strong bg-tint-teal">
          <p className="mx-auto max-w-lg px-5 py-2 text-[13px] text-ink md:max-w-6xl md:px-6 xl:max-w-[1440px]">
            <span className="font-semibold">Compte de test du formateur.</span>{" "}
            Invisible pour le groupe ; voit les contrôles en brouillon et les
            tests non ouverts.
          </p>
        </div>
      ) : null}

      {/* La place de l'écran va au cours : un stagiaire qui lit un chapitre
          avec son sommaire à côté a besoin de largeur, et les tableaux d'un
          support n'entraient pas dans une colonne de 896 px. La borne haute
          évite seulement les lignes à rallonge sur un très grand moniteur. */}
      <main className="mx-auto max-w-lg pb-[86px] md:max-w-6xl md:px-6 md:pb-12 md:pt-6 xl:max-w-[1440px]">
        {children}
      </main>

      <NavigationBasse />
    </div>
  );
}
