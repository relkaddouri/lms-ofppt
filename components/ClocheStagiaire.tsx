"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import PanneauNotifications from "./PanneauNotifications";
import { getNotificationsStagiaire } from "@/app/actions/notifications-stagiaire";
import { jouerCarillon, preparerSon } from "@/lib/son";

/**
 * La cloche du stagiaire (PRD §4.5).
 *
 * Le panneau est celui du formateur, avec une autre source : ce qui vient de
 * se passer plutôt que ce qui attend une action. D'où le résumé et l'état vide
 * réécrits — « en attente de votre intervention » n'a aucun sens ici, le
 * stagiaire n'a rien à traiter.
 *
 * Le compteur n'a pas d'accusé de lecture en base : rien à marquer, puisque
 * rien ne se résout. Il compte ce qui est arrivé depuis la dernière ouverture,
 * retenue dans le navigateur. C'est une commodité, pas un état partagé : sur
 * un autre téléphone, la pastille repart de zéro, ce qui est sans conséquence
 * — au pire elle annonce du déjà-lu.
 */
const CLE_VUES = "pedago:nouveautes-vues";
const CLE_SON = "pedago:nouveautes-son";

/**
 * Le rythme de vérification.
 *
 * Quarante-cinq secondes : assez court pour qu'un commentaire posté en classe
 * sonne pendant la séance, assez long pour qu'une matinée entière de fil
 * ouvert coûte moins de cent requêtes. Le projet n'a pas de canal temps réel,
 * et en ouvrir un pour trois tables demanderait une publication Postgres et
 * des policies de diffusion — beaucoup d'appareillage pour gagner trente
 * secondes sur une notification de cours.
 */
const RYTHME = 45_000;

function lire(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    // Navigation privée, stockage refusé : tout repart des valeurs par
    // défaut, ce qui reste préférable à un écran blanc.
    return null;
  }
}

function ecrire(cle: string, valeur: string): void {
  try {
    window.localStorage.setItem(cle, valeur);
  } catch {
    /* voir `lire` */
  }
}

export default function ClocheStagiaire() {
  const [ouvert, setOuvert] = useState(false);
  const [nouvelles, setNouvelles] = useState(0);
  const [sonne, setSonne] = useState(false);
  const [avecSon, setAvecSon] = useState(true);

  /** L'horodatage de la dernière ouverture ; tout ce qui suit est « nouveau ». */
  const depuis = useRef<string | null>(null);
  /** Le compte du tour précédent : c'est son augmentation qui fait sonner. */
  const precedent = useRef(0);
  /** Le premier chargement ne sonne pas : arriver sur la page n'est pas un événement. */
  const premier = useRef(true);
  const sonActif = useRef(true);
  const finSecousse = useRef(0);

  useEffect(() => {
    depuis.current = lire(CLE_VUES);
    const prefere = lire(CLE_SON);
    // Le son est actif par défaut : c'est la demande, et le stagiaire qui n'en
    // veut pas le coupe une fois pour toutes.
    const actif = prefere !== "0";
    setAvecSon(actif);
    sonActif.current = actif;
    return preparerSon();
  }, []);

  useEffect(() => {
    let annule = false;

    async function verifier() {
      // Onglet en arrière-plan : personne ne regarde, et un carillon sans
      // écran allumé est une sonnerie de téléphone, pas une notification.
      if (document.visibilityState !== "visible") return;
      try {
        const liste = await getNotificationsStagiaire();
        if (annule) return;
        const vu = depuis.current;
        const compte = vu
          ? liste.filter((n) => n.date > vu).length
          : liste.length;
        setNouvelles(compte);

        if (!premier.current && compte > precedent.current) {
          if (sonActif.current) jouerCarillon();
          setSonne(true);
          window.clearTimeout(finSecousse.current);
          finSecousse.current = window.setTimeout(() => setSonne(false), 900);
        }
        premier.current = false;
        precedent.current = compte;
      } catch {
        // Silencieux : une pastille manquante ne mérite pas d'alerte, et la
        // connexion d'un établissement tombe régulièrement.
      }
    }

    void verifier();
    const minuterie = window.setInterval(verifier, RYTHME);
    // Au retour sur l'onglet, on vérifie tout de suite : attendre le prochain
    // tour ferait rater ce qui est arrivé pendant l'absence.
    document.addEventListener("visibilitychange", verifier);
    return () => {
      annule = true;
      window.clearInterval(minuterie);
      window.clearTimeout(finSecousse.current);
      document.removeEventListener("visibilitychange", verifier);
    };
  }, []);

  const ouvrir = useCallback(() => {
    setOuvert(true);
    setNouvelles(0);
    setSonne(false);
    precedent.current = 0;
    const maintenant = new Date().toISOString();
    depuis.current = maintenant;
    ecrire(CLE_VUES, maintenant);
  }, []);

  const basculerSon = useCallback(() => {
    setAvecSon((actif) => {
      const cible = !actif;
      sonActif.current = cible;
      ecrire(CLE_SON, cible ? "1" : "0");
      // Le son se fait entendre au moment où on l'allume : sans cela, on
      // coche une case sans savoir ce qu'on vient d'autoriser.
      if (cible) jouerCarillon();
      return cible;
    });
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        aria-haspopup="dialog"
        aria-label={nouvelles > 0 ? `Nouveautés (${nouvelles})` : "Nouveautés"}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
      >
        <Bell size={18} aria-hidden className={sonne ? "cloche-sonne" : ""} />
        {nouvelles > 0 ? (
          <span className="absolute -right-[5px] -top-[5px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-surface bg-coral px-1 font-mono text-[11px] font-semibold text-white">
            {nouvelles > 9 ? "9+" : nouvelles}
          </span>
        ) : null}
      </button>

      <PanneauNotifications
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        charger={getNotificationsStagiaire}
        titre="Nouveautés"
        resume={(n) =>
          n === 0
            ? "Rien de neuf ces deux dernières semaines."
            : `${n} nouveauté${n > 1 ? "s" : ""} dans votre groupe`
        }
        vide="Aucune annonce, aucun commentaire, aucune réponse depuis deux semaines."
        actions={
          <button
            type="button"
            onClick={basculerSon}
            aria-pressed={avecSon}
            aria-label={
              avecSon
                ? "Couper le son des nouveautés"
                : "Activer le son des nouveautés"
            }
            title={
              avecSon
                ? "Couper le son des nouveautés"
                : "Activer le son des nouveautés"
            }
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
          >
            {avecSon ? (
              <Volume2 size={15} strokeWidth={2.2} aria-hidden />
            ) : (
              <VolumeX size={15} strokeWidth={2.2} aria-hidden />
            )}
          </button>
        }
      />
    </>
  );
}
