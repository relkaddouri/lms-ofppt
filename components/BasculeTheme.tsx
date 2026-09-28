"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  CLE_APPARENCE,
  appliquerApparence,
  type Apparence,
} from "@/lib/apparence";

/**
 * Clair, sombre, ou comme le système.
 *
 * Trois choix et non deux : la plupart des gens ne choisissent rien, et leur
 * téléphone bascule tout seul le soir. Un interrupteur à deux positions les
 * obligerait à décider une fois pour toutes, et à revenir le changer à la
 * main deux fois par jour. « Système » est donc le repos, et c'est lui par
 * défaut.
 *
 * Le choix vit dans le navigateur et non en base : il dépend de l'écran et du
 * moment, pas de la personne. Il ne coûte donc rien au serveur — aucun appel,
 * aucune lecture.
 */
const CHOIX: { cle: Apparence; Icone: typeof Sun; titre: string }[] = [
  { cle: "clair", Icone: Sun, titre: "Thème clair" },
  { cle: "sombre", Icone: Moon, titre: "Thème sombre" },
  { cle: "systeme", Icone: Monitor, titre: "Comme le système" },
];

export default function BasculeTheme({
  className = "",
}: {
  className?: string;
}) {
  const [choix, setChoix] = useState<Apparence>("systeme");

  // Le script d'amorçage a déjà posé le thème avant le premier affichage ; on
  // ne fait ici qu'aligner le bouton dessus.
  useEffect(() => {
    try {
      const garde = window.localStorage.getItem(CLE_APPARENCE);
      if (garde === "clair" || garde === "sombre" || garde === "systeme") {
        setChoix(garde);
      }
    } catch {
      // Navigation privée, stockage refusé : on reste sur « système ».
    }
  }, []);

  function choisir(cle: Apparence) {
    setChoix(cle);
    appliquerApparence(cle);
    try {
      window.localStorage.setItem(CLE_APPARENCE, cle);
    } catch {
      /* voir plus haut */
    }
  }

  return (
    <span
      role="group"
      aria-label="Apparence"
      className={`inline-flex items-center gap-0.5 rounded-[10px] border border-border bg-paper p-0.5 ${className}`}
    >
      {CHOIX.map(({ cle, Icone, titre }) => {
        const actif = choix === cle;
        return (
          <button
            key={cle}
            type="button"
            onClick={() => choisir(cle)}
            aria-pressed={actif}
            aria-label={titre}
            title={titre}
            className={`flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors duration-150 ease-out ${
              actif
                ? "bg-surface text-ink shadow-repos"
                : "text-slate-light hover:text-ink"
            }`}
          >
            <Icone size={15} strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </span>
  );
}
