import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getIdentiteStagiaire } from "@/app/actions/stagiaire";
import BarreNavigation from "./BarreNavigation";
import { initials } from "@/lib/format";

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
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-sm font-medium text-forest">
            {initials(`${identite.prenom} ${identite.nom}`)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">
              {identite.prenom} {identite.nom}
            </span>
            <span className="block text-xs text-slate">{identite.groupeNom}</span>
          </span>
        </div>
      </header>

      {/* La marge basse dégage la barre fixe, qui sinon recouvre le contenu. */}
      <main className="mx-auto max-w-lg px-4 pb-28 pt-4">{children}</main>

      <BarreNavigation />
    </div>
  );
}
