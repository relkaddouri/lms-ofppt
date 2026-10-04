"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MonitorUp, ShieldCheck, TriangleAlert, Laptop } from "lucide-react";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  BUCKET_SURVEILLANCE,
  INTERVALLE_CAPTURE_MS,
  LARGEUR_CAPTURE,
  QUALITE_CAPTURE,
  cheminCapture,
  type TypeEvenement,
} from "@/lib/surveillance";

/**
 * La surveillance d'une épreuve, côté stagiaire.
 *
 * Trois choses que le navigateur impose, et qu'on ne cherche pas à
 * contourner : le partage demande un geste à chaque passation, il affiche un
 * bandeau permanent, et le stagiaire garde un bouton pour l'arrêter. Cet
 * écran les assume plutôt que de les subir — il annonce la surveillance
 * avant, en toutes lettres, et dit aussi ce qui n'est *pas* enregistré.
 *
 * Ce qui part d'ici ne passe jamais par le serveur de l'application : les
 * captures vont droit au Storage, les événements droit à la table, sous les
 * policies de la migration 111. Une épreuve de deux heures pour vingt
 * stagiaires ne coûte donc aucune exécution.
 */

type Etape = "accueil" | "en_cours" | "incompatible";

export default function EcranSurveille({
  controleId,
  stagiaireId,
  titre,
  children,
}: {
  controleId: string;
  stagiaireId: string;
  titre: string;
  children: React.ReactNode;
}) {
  const [etape, setEtape] = useState<Etape>("accueil");
  const [refus, setRefus] = useState<string | null>(null);
  const [partageActif, setPartageActif] = useState(false);
  const [demande, setDemande] = useState(false);

  const fluxRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const minuterieRef = useRef<number | null>(null);
  const comptePourRef = useRef<string | null>(null);
  // Le dernier état de visibilité *enregistré* : sans lui, une suite de
  // bascules rapides entre onglets écrirait dix lignes pour un seul départ.
  const cacheRef = useRef(false);
  const dernierCollageRef = useRef(0);
  // Un refus ne s'enregistre qu'une fois par demi-minute. Le bouton se
  // réactive après chaque échec — c'est voulu, un refus n'est pas une
  // impasse —, mais un stagiaire qui s'acharne ne doit pas remplir le
  // journal de son formateur de trente lignes identiques.
  const dernierRefusRef = useRef(0);

  const supabase = createClient();

  /**
   * Un événement part, et s'il n'arrive pas on continue quand même.
   *
   * Le journal sert à surveiller, pas à valider l'épreuve : une ligne perdue
   * — réseau coupé, session renouvelée — ne doit en aucun cas empêcher un
   * stagiaire de composer.
   */
  const journal = useCallback(
    async (type: TypeEvenement) => {
      try {
        await supabase.from("surveillance_evenements").insert({
          controle_id: controleId,
          stagiaire_id: stagiaireId,
          type,
        });
      } catch {
        // Silence volontaire : voir ci-dessus.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controleId, stagiaireId],
  );

  /** L'identifiant du compte, pour le chemin de la capture. Lu une fois. */
  const compte = useCallback(async () => {
    if (comptePourRef.current) return comptePourRef.current;
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (typeof sub === "string" && sub) comptePourRef.current = sub;
    return comptePourRef.current;
  }, [supabase]);

  /**
   * Une capture, réduite et déposée.
   *
   * Tout se passe dans le navigateur : on dessine l'image du flux dans un
   * canevas à 640 px, on la sort en JPEG, on la pousse au Storage. Le chemin
   * étant stable, elle écrase la précédente — ce n'est pas un film, c'est un
   * reflet.
   */
  const capturer = useCallback(async () => {
    const video = videoRef.current;
    const flux = fluxRef.current;
    if (!video || !flux || video.videoWidth === 0) return;

    const userId = await compte();
    if (!userId) return;

    const echelle = LARGEUR_CAPTURE / video.videoWidth;
    const canevas = document.createElement("canvas");
    canevas.width = LARGEUR_CAPTURE;
    canevas.height = Math.round(video.videoHeight * echelle);
    const ctx = canevas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canevas.width, canevas.height);

    const image = await new Promise<Blob | null>((resoudre) =>
      canevas.toBlob(resoudre, "image/jpeg", QUALITE_CAPTURE),
    );
    if (!image) return;

    try {
      await supabase.storage
        .from(BUCKET_SURVEILLANCE)
        .upload(cheminCapture(userId, controleId), image, {
          upsert: true,
          contentType: "image/jpeg",
        });
    } catch {
      // Un dépôt manqué se rattrape au tour suivant, vingt-cinq secondes
      // plus tard. Rien à dire au stagiaire : ce n'est pas son affaire.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controleId, compte]);

  /** Tout arrêter : le flux, la minuterie, et le reflet qu'on en avait. */
  const arreter = useCallback(() => {
    if (minuterieRef.current !== null) {
      window.clearInterval(minuterieRef.current);
      minuterieRef.current = null;
    }
    fluxRef.current?.getTracks().forEach((t) => t.stop());
    fluxRef.current = null;
    setPartageActif(false);
  }, []);

  /**
   * Le geste de départ, et le seul.
   *
   * L'écran *entier* est exigé, pas l'onglet. `getDisplayMedia` laisse le
   * choix au stagiaire, et un partage d'onglet laisserait toute une fenêtre
   * voisine hors de vue : c'est cette vérification-là qui fait que la
   * surveillance tient debout. On la fait après coup, parce que la contrainte
   * `displaySurface` est une préférence que les navigateurs n'honorent pas
   * tous.
   */
  const demarrer = useCallback(async () => {
    setRefus(null);
    setDemande(true);
    try {
      const flux = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false,
      });

      const piste = flux.getVideoTracks()[0];
      const surface = piste?.getSettings().displaySurface;
      if (surface && surface !== "monitor") {
        flux.getTracks().forEach((t) => t.stop());
        setRefus(
          "Vous avez partagé une fenêtre ou un onglet. Ce contrôle demande l'écran entier : recommencez et choisissez « Écran entier ».",
        );
        setDemande(false);
        return;
      }

      fluxRef.current = flux;
      if (videoRef.current) {
        videoRef.current.srcObject = flux;
        await videoRef.current.play().catch(() => {});
      }

      // Le stagiaire peut arrêter le partage quand il veut : le navigateur lui
      // en laisse le bouton, et nous ne pouvons pas le retirer. On ne bloque
      // donc pas l'épreuve — un plantage enfermerait le stagiaire dehors. On
      // l'enregistre, et on le lui dit pour qu'il reprenne.
      piste?.addEventListener("ended", () => {
        setPartageActif(false);
        void journal("partage_arrete");
      });

      setPartageActif(true);
      setEtape("en_cours");
      setDemande(false);
      void journal("partage_accepte");

      // Une première capture tout de suite : sans elle, la carte du formateur
      // resterait vide vingt-cinq secondes alors que l'épreuve a commencé.
      void capturer();
      minuterieRef.current = window.setInterval(() => {
        void capturer();
      }, INTERVALLE_CAPTURE_MS);
    } catch {
      // Refus, ou fenêtre de choix fermée : ce n'est pas une impasse.
      setRefus(
        "Le partage n'a pas été autorisé. Ce contrôle ne peut pas commencer sans lui — réessayez.",
      );
      setDemande(false);
      const maintenant = Date.now();
      if (maintenant - dernierRefusRef.current >= 30_000) {
        dernierRefusRef.current = maintenant;
        void journal("partage_refuse");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturer, journal]);

  /** Reprendre après un arrêt : le même geste, sans repasser par l'accueil. */
  const reprendre = useCallback(async () => {
    if (minuterieRef.current !== null) {
      window.clearInterval(minuterieRef.current);
      minuterieRef.current = null;
    }
    await demarrer();
  }, [demarrer]);

  // Ni Safari sur iPhone ni sur iPad ne savent partager un écran : l'API
  // n'existe tout simplement pas. Le dire franchement vaut mieux qu'un bouton
  // qui échoue, et la carte du formateur le dira aussi.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setEtape("incompatible");
      void journal("appareil_incompatible");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les sorties de page. C'est le signal qui compte vraiment : la capture a
  // vingt-cinq secondes de retard, celui-ci est instantané.
  //
  // Et il couvre un angle mort connu : les navigateurs ralentissent les
  // minuteries d'un onglet caché à un tour par minute environ, de sorte que
  // les captures s'espacent précisément au moment où l'on voudrait les voir.
  // L'événement, lui, part sur-le-champ.
  useEffect(() => {
    if (etape !== "en_cours") return;

    const visibilite = () => {
      const cache = document.visibilityState === "hidden";
      if (cache === cacheRef.current) return;
      cacheRef.current = cache;
      void journal(cache ? "ecran_quitte" : "ecran_revenu");
    };

    const collage = () => {
      // Un collage par dizaine de secondes au plus : coller trois champs
      // d'affilée est un seul geste, pas trois alertes.
      const maintenant = Date.now();
      if (maintenant - dernierCollageRef.current < 10_000) return;
      dernierCollageRef.current = maintenant;
      void journal("collage");
    };

    document.addEventListener("visibilitychange", visibilite);
    document.addEventListener("paste", collage, true);
    return () => {
      document.removeEventListener("visibilitychange", visibilite);
      document.removeEventListener("paste", collage, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  // Quitter l'écran coupe tout : aucune piste ne reste ouverte derrière.
  useEffect(() => arreter, [arreter]);

  const contenu = (() => {
    if (etape === "incompatible") {
      return (
        <section className="flex flex-col items-start gap-3 rounded-[14px] border border-border bg-surface px-5 py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-alert-wash text-coral">
            <Laptop className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="font-display text-[20px] font-semibold text-ink">
            Cet appareil ne permet pas la surveillance
          </h1>
          <p className="text-[15px] leading-relaxed text-body">
            {titre} est un contrôle surveillé : il demande le partage de votre
            écran, et ni l&apos;iPhone ni l&apos;iPad ne savent le faire.
            Composez depuis un ordinateur.
          </p>
          <p className="text-[14px] leading-relaxed text-slate">
            Votre formateur voit que vous vous êtes présenté depuis un appareil
            incompatible : prévenez-le si vous n&apos;avez pas d&apos;ordinateur.
          </p>
        </section>
      );
    }

    if (etape === "accueil") {
      return (
        <section className="flex flex-col items-start gap-4 rounded-[14px] border border-border bg-surface px-5 py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-wash-strong text-slate-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[20px] font-semibold text-ink">
              Ce contrôle est surveillé
            </h1>
            <p className="text-[15px] leading-relaxed text-body">
              {titre} se compose sous surveillance. Votre formateur verra votre
              écran pendant toute l&apos;épreuve.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 rounded-[10px] bg-paper px-4 py-3.5">
            <p className="text-[14px] font-semibold text-ink">
              Ce qui est enregistré
            </p>
            <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-body">
              <li>Une image de votre écran, toutes les 25 secondes.</li>
              <li>Les moments où vous quittez la page du contrôle.</li>
              <li>Les collages dans vos réponses.</li>
            </ul>
            <p className="text-[14px] font-semibold text-ink">
              Ce qui ne l&apos;est pas
            </p>
            <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-body">
              <li>Ni votre micro, ni votre caméra.</li>
              <li>Ni ce que vous tapez au clavier.</li>
              <li>Rien en dehors de la durée de l&apos;épreuve.</li>
            </ul>
          </div>

          <p className="text-[14px] leading-relaxed text-slate">
            Votre navigateur vous demandera de choisir <strong>l&apos;écran
            entier</strong> — une fenêtre ou un onglet seuls ne suffisent pas. Il
            affichera ensuite un bandeau pendant tout le partage, et vous pourrez
            l&apos;arrêter à tout moment : votre formateur en sera informé.
          </p>

          {refus ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-[14px] leading-relaxed text-coral"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {refus}
            </p>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            icon={MonitorUp}
            onClick={() => void demarrer()}
            loading={demande}
            loadingLabel="En attente du partage…"
          >
            Partager mon écran et commencer
          </Button>

        </section>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {/*
          Le bandeau reste là tant que l'épreuve dure. Il ne clignote pas et ne
          se ferme pas : une surveillance se sait, elle ne se rappelle pas.
        */}
        {partageActif ? (
          <p className="flex items-center gap-2 rounded-[10px] border border-border bg-paper px-4 py-2.5 text-[14px] text-body">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal" aria-hidden />
            Surveillance active : votre écran est partagé avec votre formateur.
          </p>
        ) : (
          <div
            role="alert"
            className="flex flex-col items-start gap-2.5 rounded-[10px] border border-coral-soft bg-alert-wash px-4 py-3"
          >
            <p className="flex items-start gap-2 text-[14px] leading-relaxed text-coral">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Le partage de votre écran s&apos;est arrêté. Votre copie n&apos;est
              pas perdue et vous pouvez continuer à écrire, mais votre formateur
              a été informé de l&apos;interruption.
            </p>
            <Button variant="secondary" size="sm" icon={MonitorUp} onClick={() => void reprendre()}>
              Reprendre le partage
            </Button>
          </div>
        )}

        {children}

      </div>
    );
  
  })();

  /*
    La vidéo cachée vit en dehors des branches, et c'est voulu : montée une
    seule fois, elle garde le flux quand l'étape change. Rendue dans chaque
    branche, elle se démontait au passage de l'accueil à l'épreuve et
    emportait le partage avec elle.
  */
  return (
    <>
      {contenu}
      <video ref={videoRef} muted playsInline className="hidden" />
    </>
  );
}
