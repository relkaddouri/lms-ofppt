"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import PanneauNotifications from "./PanneauNotifications";
import type { Notification } from "@/app/actions/notifications";
import { jouerCarillon, preparerSon } from "@/lib/son";

/**
 * La cloche, et le carillon qui la fait entendre.
 *
 * Une seule pour les deux espaces. Ce qui les sépare tient en trois choses —
 * la source, les mots, et ce que compte la pastille — et tout le reste est
 * identique : le rythme de vérification, le déverrouillage du son, la
 * secousse, la coupure. Deux cloches auraient divergé au premier correctif,
 * comme les deux panneaux avant elles.
 *
 * Le carillon se déclenche sur l'**apparition d'une entrée**, jamais sur la
 * valeur du compteur. Chez le formateur le compteur descend quand il traite
 * une tâche : répondre à une question pendant qu'un commentaire arrive
 * laisserait le total inchangé, et un simple `compte > précédent` n'aurait
 * rien sonné. Les identifiants, eux, ne mentent pas.
 */
export default function Cloche({
  charger,
  titre,
  resume,
  vide,
  cle,
  mesure = "nouveaux",
  sonnePour,
  compteInitial = 0,
  className,
}: {
  charger: () => Promise<Notification[]>;
  titre: string;
  resume: (nombre: number) => string;
  vide: string;
  /** Préfixe des clés de stockage : les deux espaces ne partagent pas leurs réglages. */
  cle: string;
  /**
   * Ce que dit la pastille.
   *
   * `total` chez le formateur — c'est un reste à faire, et il doit le voir en
   * entier même s'il a déjà ouvert le panneau. `nouveaux` chez le stagiaire —
   * rien ne l'attend, seul compte ce qui est arrivé depuis son dernier regard.
   */
  mesure?: "total" | "nouveaux";
  /**
   * Ce qui mérite d'être entendu, quand tout ne le mérite pas.
   *
   * Le formateur ne se fait pas sonner par lui-même : un contrôle qu'il vient
   * de laisser en brouillon est bien une tâche de plus dans son panneau, mais
   * il le sait déjà — il vient de l'écrire. Seul ce qui vient d'un stagiaire
   * carillonne. Par défaut, tout carillonne : chez le stagiaire, rien de ce
   * qui remonte ne vient de lui.
   */
  sonnePour?: (notification: Notification) => boolean;
  /** Compte rendu par le serveur, affiché avant que la première relecture réponde. */
  compteInitial?: number;
  /** Le bouton n'a pas la même taille d'un espace à l'autre. */
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [compte, setCompte] = useState(compteInitial);
  const [sonne, setSonne] = useState(false);
  const [avecSon, setAvecSon] = useState(true);

  /** L'horodatage du dernier regard ; tout ce qui suit est « nouveau ». */
  const depuis = useRef<string | null>(null);
  /** Les entrées déjà vues : c'est leur nouveauté, pas leur nombre, qui sonne. */
  const connues = useRef<Set<string> | null>(null);
  const sonActif = useRef(true);
  const finSecousse = useRef(0);

  const cleVues = `pedago:${cle}-vues`;
  const cleSon = `pedago:${cle}-son`;

  useEffect(() => {
    depuis.current = lire(cleVues);
    // Le son est actif par défaut ; qui n'en veut pas le coupe une fois pour
    // toutes, depuis le panneau.
    const actif = lire(cleSon) !== "0";
    setAvecSon(actif);
    sonActif.current = actif;
    return preparerSon();
  }, [cleVues, cleSon]);

  useEffect(() => {
    let annule = false;

    async function verifier() {
      // Onglet en arrière-plan : personne ne regarde, et un carillon sans
      // écran allumé est une sonnerie de téléphone, pas une notification.
      if (document.visibilityState !== "visible") return;
      try {
        const liste = await charger();
        if (annule) return;

        const vu = depuis.current;
        setCompte(
          mesure === "total"
            ? liste.length
            : vu
              ? liste.filter((n) => n.date > vu).length
              : liste.length,
        );

        const ids = new Set(liste.map((n) => n.id));
        // La première relecture ne sonne pas : arriver sur une page n'est pas
        // un événement, et douze entrées en attente donneraient un carillon à
        // chaque navigation.
        if (connues.current) {
          const arrivee = liste.some(
            (n) =>
              !connues.current?.has(n.id) && (sonnePour ? sonnePour(n) : true),
          );
          if (arrivee) {
            if (sonActif.current) jouerCarillon();
            setSonne(true);
            window.clearTimeout(finSecousse.current);
            finSecousse.current = window.setTimeout(() => setSonne(false), 900);
          }
        }
        connues.current = ids;
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
  }, [charger, mesure, sonnePour]);

  const ouvrir = useCallback(() => {
    setOuvert(true);
    setSonne(false);
    const maintenant = new Date().toISOString();
    depuis.current = maintenant;
    ecrire(cleVues, maintenant);
    // Le reste à faire du formateur ne s'efface pas parce qu'il l'a regardé.
    if (mesure === "nouveaux") setCompte(0);
  }, [cleVues, mesure]);

  const basculerSon = useCallback(() => {
    // L'état courant se lit dans la référence et non dans une fonction de mise
    // à jour : React peut rappeler celle-ci — il le fait systématiquement en
    // développement — et le carillon sonnait deux fois. Une fonction de mise à
    // jour doit rester pure ; le réglage vit de toute façon dans la référence,
    // que la boucle de relecture consulte à chaque tour.
    const cible = !sonActif.current;
    sonActif.current = cible;
    setAvecSon(cible);
    ecrire(cleSon, cible ? "1" : "0");
    // Le son se fait entendre au moment où on l'allume : sans cela, on coche
    // une case sans savoir ce qu'on vient d'autoriser.
    if (cible) jouerCarillon();
  }, [cleSon]);

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        aria-haspopup="dialog"
        aria-label={compte > 0 ? `${titre} (${compte})` : titre}
        className={
          className ??
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
        }
      >
        <Bell
          size={18}
          strokeWidth={2}
          aria-hidden
          className={sonne ? "cloche-sonne" : ""}
        />
        {compte > 0 ? (
          <span className="absolute -right-[5px] -top-[5px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-surface bg-coral px-1 font-mono text-[11px] font-semibold text-white">
            {compte > 99 ? "99+" : compte}
          </span>
        ) : null}
      </button>

      <PanneauNotifications
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        charger={charger}
        titre={titre}
        resume={resume}
        vide={vide}
        actions={
          <button
            type="button"
            onClick={basculerSon}
            aria-pressed={avecSon}
            aria-label={avecSon ? `Couper le son` : `Activer le son`}
            title={
              avecSon
                ? "Couper le son des notifications"
                : "Activer le son des notifications"
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

/**
 * Les réglages tiennent dans le navigateur, et c'est assumé.
 *
 * Il n'y a pas d'accusé de lecture en base parce qu'il n'y aurait rien à
 * marquer : chez le stagiaire rien ne se résout, et chez le formateur c'est
 * le travail fait qui fait disparaître une ligne. Sur un autre appareil, le
 * dernier regard repart donc de zéro — au pire la pastille annonce du
 * déjà-lu, ce qui ne coûte rien.
 */
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
