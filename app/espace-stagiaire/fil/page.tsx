import Link from "next/link";
import { ChevronDown, Newspaper } from "lucide-react";
import { getIdentiteStagiaire } from "@/app/actions/stagiaire";
import { getFil, getCamarades } from "@/app/actions/fil";
import { getIdentiteFormateur } from "@/app/actions/profil";
import CarteAnnonce from "./CarteAnnonce";
import EnConstruction from "../EnConstruction";
import EnTete from "../EnTete";

export const metadata = { title: "Fil" };

/**
 * Combien d'annonces la page montre, d'après l'adresse.
 *
 * La fenêtre vit là et non dans un état du navigateur : les commentaires se
 * rafraîchissent par un nouveau rendu du serveur, et un état client aurait figé
 * la liste — un commentaire posté ne serait jamais apparu.
 */
function fenetreDemandee(valeur: string | string[] | undefined): number {
  const n = Number(Array.isArray(valeur) ? valeur[0] : valeur);
  return Number.isFinite(n) && n > 0 ? n : OUVERTURE;
}

/** Ce que la page montre en arrivant : les quatre dernières annonces. */
const OUVERTURE = 4;

/**
 * Ce qu'un clic ajoute.
 *
 * Vingt et non quatre : remonter à octobre demanderait sinon vingt-cinq clics,
 * et chaque clic est un rendu de page facturé. Le coût est dans la première
 * ouverture, qui arrive des dizaines de fois par jour ; celui qui cherche une
 * vieille annonce le fait une fois.
 */
const PAS = 20;

export default async function FilPage({
  searchParams,
}: PageProps<"/espace-stagiaire/fil">) {
  const identite = await getIdentiteStagiaire();
  // Le layout a déjà écarté les non-stagiaires ; ceci n'est qu'une garde.
  if (!identite) return null;

  const fenetre = fenetreDemandee((await searchParams).annonces);

  const [page, camarades, formateur] = await Promise.all([
    getFil(identite.groupeId, fenetre),
    getCamarades(identite.groupeId),
    // Mémorisée pour le rendu : `getFil` vient déjà de la demander.
    getIdentiteFormateur(),
  ]);

  if (page.annonces.length === 0) {
    return (
      <EnConstruction
        titre="Aucune annonce"
        description="Les annonces de votre formateur apparaîtront ici. Vous pourrez y réagir et les commenter."
        Icone={Newspaper}
      />
    );
  }

  return (
    // Une carte par annonce, et non un seul bloc découpé par des filets.
    // Empilées sans respiration, les annonces se lisaient comme une liste de
    // courses : on ne voyait plus où l'une finissait et où la suivante
    // commençait, d'autant que chacune porte maintenant ses commentaires.
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <EnTete
        surtitre="Fil du groupe"
        titre="Annonces"
        dansCarte={false}
        resume={
          <>
            {/* Les plus récentes, et non le total : le fil ne les lit plus
                toutes d'un coup, et annoncer un nombre qu'on n'a pas compté
                serait inventer. */}
            Les annonces de {formateur.nom ?? "votre formateur"}
          </>
        }
      />

      {page.annonces.map((a) => (
        <CarteAnnonce
          key={a.id}
          annonce={a}
          camarades={camarades}
          formateur={formateur}
          moi={{
            nom: `${identite.prenom} ${identite.nom}`,
            photo: identite.photo,
            photoUrl: null,
            cestMoi: true,
          }}
        />
      ))}

      <div className="flex justify-center px-5 pb-2 pt-2">
        {page.encore ? (
          /* Un lien et non un bouton : la fenêtre est dans l'adresse, donc
             elle survit à un rafraîchissement et se partage. `scroll={false}`
             garde la lecture où elle en était. */
          <Link
            href={`/espace-stagiaire/fil?annonces=${fenetre + PAS}`}
            scroll={false}
            className="inline-flex items-center gap-2 rounded-[10px] border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-body transition hover:bg-paper"
          >
            <ChevronDown className="size-4" aria-hidden />
            Afficher plus d&apos;annonces
          </Link>
        ) : (
          <span className="font-mono text-xs text-border-strong">
            Fin du fil · {page.annonces.length} annonce
            {page.annonces.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
