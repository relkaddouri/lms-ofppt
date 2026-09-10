import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Le retour d'une page de détail vers la liste dont elle vient.
 *
 * Sous le gabarit d'un groupe, l'onglet allumé indique déjà la section et sert
 * de chemin de retour — mais il l'indique, il ne le propose pas. Sur une page
 * de détail, on cherche un geste explicite, et le trouver dans une barre
 * d'onglets suppose d'avoir compris que la barre est cliquable.
 *
 * D'où ce lien, et pas un fil d'Ariane : le fil répétait le nom du groupe et
 * de la section, déjà écrits deux fois au-dessus. Celui-ci ne dit qu'une
 * chose, celle qu'on cherche.
 *
 * La cible de 44 px est tenue par le `py` : c'est une cible de doigt, comme
 * tout ce qui est cliquable sous 768 px (design_system §3bis).
 */
export default function RetourListe({
  href,
  libelle,
}: {
  href: string;
  /** Ce vers quoi on revient — « la progression », « les modules ». */
  libelle: string;
}) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-slate-2 transition-colors duration-150 ease-out hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <ArrowLeft size={16} aria-hidden />
      Retour à {libelle}
    </Link>
  );
}
