"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Feux from "@/components/Feux";
import Button from "@/components/ui/Button";
import {
  getDistinctionAFeter,
  marquerDistinctionVue,
  type DistinctionAFeter,
} from "@/app/actions/distinction";
import { Crown } from "lucide-react";

/**
 * La fête du stagiaire de la journée (PRD §4.5).
 *
 * Elle s'ouvre à l'arrivée dans l'application, pour tout le groupe : chacun
 * apprend qui a été distingué, et le félicite ensuite dans le fil. Une fois
 * fermée, elle ne revient pas — la table `distinctions_vues` le retient, sans
 * quoi une célébration deviendrait une gêne au troisième affichage.
 */

/**
 * La fête elle-même, sans savoir d'où vient la distinction.
 *
 * Séparée du chargement pour que l'aperçu du formateur montre exactement ce
 * que le stagiaire verra. Deux rendus distincts auraient fini par diverger, et
 * l'aperçu aurait cessé d'être un aperçu.
 */
export function FeteDistinction({
  fete,
  onFermer,
  apercu = false,
}: {
  fete: DistinctionAFeter;
  onFermer: () => void;
  /** En aperçu, le bouton dit ce qu'il fait : il ferme, il ne remercie pas. */
  apercu?: boolean;
}) {
  const nom = `${fete.prenom} ${fete.nom}`.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stagiaire de la journée"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-5 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[20px] border border-border bg-surface px-6 py-8 text-center shadow-repos">
        <Feux actif />

        <div className="relative flex flex-col items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-wash text-green-dark">
            <Crown size={22} aria-hidden />
          </span>

          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-light">
            Stagiaire de la journée
          </p>

          <span className="relative">
            <Avatar
              nom={fete.nom}
              prenom={fete.prenom}
              photo={fete.photo}
              taille="lg"
              className="h-[88px] w-[88px] text-[30px]"
            />
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-[#F4C542] text-ink"
            >
              <Crown size={15} aria-hidden />
            </span>
          </span>

          <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
            {fete.cestMoi ? `Bravo ${fete.prenom} !` : `Bravo à ${nom} !`}
          </h2>

          <p className="text-[15px] leading-relaxed text-body">
            {fete.cestMoi
              ? "Tu es distingué pour ta participation d'aujourd'hui."
              : `${fete.prenom} est distingué pour sa participation d'aujourd'hui.`}
          </p>

          {/* La série ne s'annonce qu'à partir du deuxième jour : « 1 jour
              d'affilée » ne veut rien dire. */}
          {fete.serie > 1 ? (
            <p className="rounded-full bg-tint-teal px-3.5 py-1.5 text-[13.5px] font-semibold text-teal-dark">
              {fete.serie} jours d&apos;affilée — impressionnant.
            </p>
          ) : null}

          <Button onClick={onFermer} className="mt-1 w-full justify-center">
            {apercu
              ? "Fermer l'aperçu"
              : fete.cestMoi
                ? "Merci !"
                : "Le féliciter"}
          </Button>

          <p className="text-[12.5px] text-slate-light">
            {apercu
              ? "Voilà ce que le groupe verra en ouvrant l'application."
              : "Une annonce vous attend dans le fil pour le féliciter."}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Ce que le stagiaire voit en arrivant : la fête, une fois, puis plus jamais.
 */
export default function ModaleDistinction() {
  const [fete, setFete] = useState<DistinctionAFeter | null>(null);

  useEffect(() => {
    let annule = false;
    getDistinctionAFeter()
      .then((d) => {
        if (!annule) setFete(d);
      })
      // Silencieux : rater une fête n'est pas une erreur à signaler au
      // stagiaire, qui n'y peut rien et n'attendait rien.
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, []);

  if (!fete) return null;

  return (
    <FeteDistinction
      fete={fete}
      onFermer={() => {
        const id = fete.id;
        setFete(null);
        void marquerDistinctionVue(id).catch(() => {});
      }}
    />
  );
}
