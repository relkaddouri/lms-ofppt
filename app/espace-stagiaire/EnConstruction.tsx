import type { LucideIcon } from "lucide-react";

/**
 * Écran d'un onglet dont le contenu n'est pas encore construit.
 *
 * Il dit ce qui viendra plutôt que « aucune donnée » : un stagiaire qui ouvre
 * un onglet vide doit comprendre que l'application n'est pas cassée.
 */
export default function EnConstruction({
  titre,
  description,
  Icone,
}: {
  titre: string;
  description: string;
  Icone: LucideIcon;
}) {
  return (
    <section className="rounded-[14px] border border-border bg-surface px-4 py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wash">
        <Icone className="h-6 w-6 text-ink" aria-hidden />
      </span>
      <h1 className="mt-4 text-base font-semibold text-ink">{titre}</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate">{description}</p>
    </section>
  );
}
