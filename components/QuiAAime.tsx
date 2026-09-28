"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import type { QuiAime } from "@/app/actions/fil";

/**
 * Qui a aimé, sous une annonce.
 *
 * Le compte seul ne répond pas à la question que le geste pose. « 7 » ne dit
 * pas si ses camarades ont aimé, ni si le formateur l'a fait ; dans une classe
 * de dix-huit, c'est exactement ce qu'on veut savoir.
 *
 * Deux niveaux, et pas un de plus. D'abord une ligne lisible sans rien ouvrir
 * — trois visages empilés et une phrase, qui suffit la plupart du temps parce
 * que les noms qu'on cherche sont les premiers. Puis la liste entière, dans
 * une modale, pour les fois où elle ne suffit pas. Tout mettre à plat sous
 * chaque annonce aurait allongé le fil de dix lignes par billet ; n'afficher
 * qu'un nombre cliquable aurait obligé à ouvrir pour la question la plus
 * courante.
 *
 * Rien n'est demandé au serveur à l'ouverture : la liste est déjà là, arrivée
 * avec l'annonce.
 */

/** Combien de visages tiennent sur la ligne avant de devenir une bouillie. */
const VISAGES = 3;

export default function QuiAAime({ qui }: { qui: QuiAime[] }) {
  const [ouvert, setOuvert] = useState(false);

  if (qui.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        className="flex min-h-[34px] items-center gap-2 self-start rounded-[9px] pr-1.5 text-left text-[13.5px] text-slate-2 transition-colors duration-150 ease-out hover:text-ink"
      >
        <span className="flex shrink-0 items-center">
          {qui.slice(0, VISAGES).map((p, i) => (
            <Avatar
              key={`${p.nom}-${i}`}
              prenom={p.nom}
              photo={p.photo}
              photoUrl={p.photoUrl}
              taille="xs"
              empile
              className="h-[26px] w-[26px] text-[9.5px]"
            />
          ))}
        </span>
        <span className="min-w-0 truncate">{phrase(qui)}</span>
      </button>

      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="J'aime"
        description={
          <span className="flex items-center gap-1.5">
            <Heart size={14} className="fill-coral text-coral" aria-hidden />
            {qui.length} personne{qui.length > 1 ? "s" : ""}
          </span>
        }
      >
        {/* La liste défile au-delà d'une dizaine : un groupe entier qui aime
            une annonce ne doit pas pousser la modale hors de l'écran. */}
        <ul className="-mx-1 max-h-[46vh] overflow-y-auto">
          {qui.map((p, i) => (
            <li
              key={`${p.nom}-${i}`}
              className="flex items-center gap-3 border-b border-separator px-1 py-2.5 last:border-0"
            >
              <Avatar
                prenom={p.nom}
                photo={p.photo}
                photoUrl={p.photoUrl}
                taille="sm"
              />
              <span className="min-w-0 truncate text-[15px] text-ink">
                {p.cestMoi ? "Vous" : p.nom}
              </span>
              {p.cestMoi ? (
                <Heart
                  size={15}
                  className="ml-auto shrink-0 fill-coral text-coral"
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

/**
 * « Vous et 6 autres », « Sara NAIT AISSI et ISMAIL ABOUZAID ».
 *
 * Deux noms au plus, puis un reste compté : trois noms marocains complets
 * dépassent la largeur d'un téléphone, et la ligne se coupe au milieu du
 * deuxième — ce qui ne nomme plus personne.
 */
function phrase(qui: QuiAime[]): string {
  const nom = (p: QuiAime) => (p.cestMoi ? "Vous" : p.nom);
  if (qui.length === 1) return `${nom(qui[0]!)} aime`;
  if (qui.length === 2) return `${nom(qui[0]!)} et ${nom(qui[1]!)}`;
  const reste = qui.length - 1;
  return `${nom(qui[0]!)} et ${reste} autres`;
}
