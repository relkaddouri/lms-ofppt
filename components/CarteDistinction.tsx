"use client";

import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Feux from "@/components/Feux";
import type { DistinctionFil } from "@/app/actions/fil";

/**
 * La distinction telle qu'elle se lit dans le fil (PRD §4.5).
 *
 * La modale s'ouvre une fois, à l'arrivée, et ne revient jamais — elle
 * annonce. Cette carte reste : c'est la trace, celle qu'on retrouve deux
 * jours plus tard en remontant le fil, et sous laquelle les félicitations
 * s'accumulent. Elle reprend donc les signes de la modale — couronne, visage
 * en grand, série, gerbes — dans le vocabulaire du fil : pleine largeur, pas
 * de fond sombre, pas de bouton de fermeture.
 *
 * Les gerbes partent quand la carte entre à l'écran, et une seule fois. Les
 * lancer au montage les gaspillerait sur une carte encore sous la ligne de
 * flottaison ; les relancer à chaque passage ferait de la fête un clignotant.
 */
export default function CarteDistinction({
  distinction,
  contenu,
}: {
  distinction: DistinctionFil;
  /** Le texte de l'annonce, gardé pour ce qu'il dit de plus que la carte. */
  contenu: string | null;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    // Sans IntersectionObserver — navigateur ancien — la fête a lieu tout de
    // suite : mieux vaut des gerbes ratées qu'une carte morte.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  const nom = `${distinction.prenom} ${distinction.nom}`.trim();

  return (
    <div
      ref={cadre}
      className="relative overflow-hidden rounded-[16px] border border-[#E8D9A6] bg-[linear-gradient(180deg,#FDF8EA_0%,var(--surface)_78%)] px-5 py-6"
    >
      {/* 0,3 et non 0,38 : la carte est basse et large, et les gerbes de la
          modale éclateraient dans le texte. */}
      <Feux actif={visible} hauteurGerbe={0.3} />

      <div className="relative flex flex-col items-center gap-3 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-light">
          Stagiaire de la journée
        </p>

        <span className="relative">
          <Avatar
            nom={distinction.nom}
            prenom={distinction.prenom}
            photo={distinction.photo}
            taille="lg"
            className="h-[76px] w-[76px] text-[26px]"
          />
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-[#F4C542] text-ink"
          >
            <Crown size={14} aria-hidden />
          </span>
        </span>

        <h2 className="font-display text-[20px] font-bold leading-tight text-ink">
          {distinction.cestMoi
            ? `Bravo ${distinction.prenom} !`
            : `Bravo à ${nom} !`}
        </h2>

        <p className="max-w-[38ch] text-[15px] leading-relaxed text-body">
          {contenu?.trim()
            ? contenu
            : distinction.cestMoi
              ? "Tu es distingué pour ta participation d'aujourd'hui."
              : `${distinction.prenom} est distingué pour sa participation d'aujourd'hui.`}
        </p>

        {/* La série ne s'annonce qu'à partir du deuxième jour : « 1 jour
            d'affilée » ne veut rien dire. */}
        {distinction.serie > 1 ? (
          <p className="rounded-full bg-tint-teal px-3.5 py-1.5 text-[13.5px] font-semibold text-teal-dark">
            {distinction.serie} jours d&apos;affilée — impressionnant.
          </p>
        ) : null}
      </div>
    </div>
  );
}
