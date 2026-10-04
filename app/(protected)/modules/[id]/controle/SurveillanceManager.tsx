"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  MonitorOff,
  RefreshCw,
  ScreenShare,
  X,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import {
  effacerSurveillance,
  getSurveillance,
  type SurveilleListe,
} from "@/app/actions/surveillance";
import {
  GRAVITE_ETAT,
  INTERVALLE_CAPTURE_MS,
  LIBELLES_ETAT,
  TYPES_EVENEMENT,
  etatDuStagiaire,
  parStagiaire,
  type EvenementSurveillance,
  type TypeEvenement,
} from "@/lib/surveillance";

/**
 * La mosaïque : voir les écrans d'un groupe pendant une épreuve.
 *
 * Deux façons de regarder, et elles ne servent pas la même chose. La grille
 * répond à « est-ce que tout va bien ? » d'un coup d'œil — on ne lit pas
 * vingt vignettes, on repère la carte qui a changé de couleur. Le mode un par
 * un répond à « que fait celui-là ? », en grand, les flèches pour passer au
 * suivant.
 *
 * Ce que l'écran coûte au serveur : une lecture au chargement, et plus rien.
 * Les états arrivent par Realtime, un websocket ; les images se relisent
 * directement au Storage avec une URL signée pour toute l'épreuve. Une
 * surveillance de deux heures ne réveille donc Vercel qu'une seule fois.
 */

const COULEURS = {
  neutre: "border-border bg-surface",
  attention: "border-tint-warn bg-warn-wash",
  alerte: "border-coral-soft bg-alert-wash",
} as const;

const PASTILLES = {
  neutre: "bg-slate-2",
  attention: "bg-amber",
  alerte: "bg-coral",
} as const;

/** « 14:32:05 » : l'heure de la dernière relecture, à la seconde près. */
const heure = (ms: number) =>
  new Date(ms).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const estTypeConnu = (v: string): v is TypeEvenement =>
  (TYPES_EVENEMENT as readonly string[]).includes(v);

export default function SurveillanceManager({
  controleId,
  controleTitre,
}: {
  controleId: string;
  controleTitre: string;
}) {
  const toast = useToast();
  const [chargement, setChargement] = useState(true);
  const [surveille, setSurveille] = useState(false);
  const [stagiaires, setStagiaires] = useState<SurveilleListe[]>([]);
  const [evenements, setEvenements] = useState<EvenementSurveillance[]>([]);
  const [agrandi, setAgrandi] = useState<string | null>(null);
  const [confirmeEffacement, setConfirmeEffacement] = useState(false);
  const [efface, setEfface] = useState(false);
  // Change toutes les vingt-cinq secondes, et c'est tout ce qui fait relire
  // les images : accolé à l'URL signée, il contourne le cache du navigateur
  // sans rien redemander à personne.
  const [tic, setTic] = useState(() => Date.now());
  // Le grand format se relit plus souvent que la grille : on n'y regarde
  // qu'une image, et c'est là qu'on veut voir ce qui se passe maintenant.
  const [ticGrand, setTicGrand] = useState(() => Date.now());

  const supabase = createClient();
  const vus = useRef(new Set<string>());

  useEffect(() => {
    let vivant = true;
    getSurveillance(controleId)
      .then((e) => {
        if (!vivant) return;
        setSurveille(e.surveille);
        setStagiaires(e.stagiaires);
        setEvenements(e.evenements);
        for (const ev of e.evenements) vus.current.add(ev.id);
      })
      .catch((err: unknown) => {
        toast(err instanceof Error ? err.message : "Lecture impossible", "error");
      })
      .finally(() => vivant && setChargement(false));
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controleId]);

  // Le direct. Chaque insertion arrive ici sans qu'on demande rien, et les
  // policies du jeton font le tri : on ne reçoit que les contrôles qu'on peut
  // déjà lire.
  useEffect(() => {
    const canal = supabase
      .channel(`surveillance:${controleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "surveillance_evenements",
          filter: `controle_id=eq.${controleId}`,
        },
        (charge) => {
          const l = charge.new as {
            id: string;
            stagiaire_id: string;
            type: string;
            cree_le: string;
          };
          // Realtime peut répéter une insertion après une reconnexion : sans
          // ce garde-fou, un même événement compterait deux fois.
          if (!l?.id || vus.current.has(l.id) || !estTypeConnu(l.type)) return;
          vus.current.add(l.id);
          setEvenements((avant) => [
            {
              id: l.id,
              stagiaireId: l.stagiaire_id,
              type: l.type as TypeEvenement,
              creeLe: l.cree_le,
            },
            ...avant,
          ]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controleId]);

  // Les images se rafraîchissent au rythme où elles sont déposées. Rien ne
  // part vers le serveur de l'application : c'est le Storage qui répond.
  // La page cachée se met en pause — un onglet qu'on ne regarde pas n'a
  // aucune raison de retélécharger vingt images.
  useEffect(() => {
    const battre = () => {
      if (document.visibilityState === "visible") setTic(Date.now());
    };
    const minuterie = window.setInterval(battre, INTERVALLE_CAPTURE_MS);
    document.addEventListener("visibilitychange", battre);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", battre);
    };
  }, []);

  // Une seule image à l'écran, donc on peut la relire toutes les dix
  // secondes sans peser : seize vignettes au même rythme coûteraient seize
  // fois plus pour un détail qu'on ne lit pas en vignette.
  useEffect(() => {
    if (!agrandi) return;
    const minuterie = window.setInterval(() => {
      if (document.visibilityState === "visible") setTicGrand(Date.now());
    }, 10_000);
    return () => window.clearInterval(minuterie);
  }, [agrandi]);

  const parEleve = useMemo(() => parStagiaire(evenements), [evenements]);

  // Les cartes se rangent par ce qui demande un regard, puis par nom : la
  // carte qui va mal remonte d'elle-même, sans qu'on ait à la chercher.
  const ordre = { alerte: 0, attention: 1, neutre: 2 } as const;
  const cartes = useMemo(
    () =>
      stagiaires
        .map((s) => {
          const { etat, collages } = etatDuStagiaire(parEleve.get(s.stagiaireId) ?? []);
          return { ...s, etat, collages, gravite: GRAVITE_ETAT[etat] };
        })
        .sort(
          (a, b) =>
            ordre[a.gravite] - ordre[b.gravite] || a.nom.localeCompare(b.nom, "fr"),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stagiaires, parEleve],
  );

  const index = agrandi ? cartes.findIndex((c) => c.stagiaireId === agrandi) : -1;

  const glisser = useCallback(
    (pas: number) => {
      if (cartes.length === 0) return;
      setAgrandi((actuel) => {
        const i = actuel ? cartes.findIndex((c) => c.stagiaireId === actuel) : -1;
        if (i < 0) return actuel;
        const suivant = (i + pas + cartes.length) % cartes.length;
        return cartes[suivant]!.stagiaireId;
      });
    },
    [cartes],
  );

  // Les flèches passent d'un stagiaire au suivant sans quitter le grand
  // format : c'est le geste qu'on fait vingt fois pendant une épreuve.
  useEffect(() => {
    if (!agrandi) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") glisser(1);
      else if (e.key === "ArrowLeft") glisser(-1);
      else if (e.key === "Escape") setAgrandi(null);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [agrandi, glisser]);

  async function effacer() {
    setEfface(true);
    try {
      await effacerSurveillance(controleId);
      setEvenements([]);
      vus.current.clear();
      setStagiaires((avant) => avant.map((s) => ({ ...s, capture: null })));
      setConfirmeEffacement(false);
      toast("Captures et journal effacés.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Effacement impossible", "error");
    } finally {
      setEfface(false);
    }
  }

  const url = (c: SurveilleListe, instant = tic) =>
    c.capture
      ? `${c.capture}${c.capture.includes("?") ? "&" : "?"}t=${instant}`
      : null;

  if (chargement) {
    return (
      <p className="mt-6 rounded-[14px] border border-border bg-surface p-4 text-sm text-slate shadow-repos">
        Lecture des écrans…
      </p>
    );
  }

  if (!surveille) {
    return (
      <div className="mt-6 flex flex-col items-start gap-3 rounded-[14px] border border-border bg-surface p-5 shadow-repos">
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-wash-strong text-slate-2">
          <MonitorOff className="h-5 w-5" aria-hidden />
        </span>
        <p className="font-display text-[16px] font-semibold text-ink">
          Ce contrôle n&apos;est pas surveillé
        </p>
        <p className="max-w-prose text-[14px] leading-relaxed text-slate">
          Mettez « Surveiller les écrans » avant de l&apos;ouvrir au groupe, dans
          le bloc Passation en ligne. La surveillance se décide à
          l&apos;ouverture : les stagiaires doivent l&apos;apprendre avant de
          composer, pas la découvrir en cours d&apos;épreuve.
        </p>
      </div>
    );
  }

  const grand = index >= 0 ? cartes[index] : null;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-wash-strong text-slate-2">
          <ScreenShare className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-[16px] font-semibold text-ink">
            Écrans du groupe
          </span>
          <span className="text-[14px] text-slate-2">
            {cartes.length} stagiaire{cartes.length > 1 ? "s" : ""} · images
            relues à {heure(tic)}, et toutes les 25 secondes
          </span>
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          onClick={() => {
            const maintenant = Date.now();
            setTic(maintenant);
            setTicGrand(maintenant);
          }}
        >
          Rafraîchir
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={Eraser}
          onClick={() => setConfirmeEffacement(true)}
        >
          Effacer les captures
        </Button>
      </div>

      {cartes.length === 0 ? (
        <p className="rounded-[14px] border border-border bg-surface p-4 text-sm text-slate shadow-repos">
          Aucun stagiaire dans ce groupe.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cartes.map((c) => {
            const image = url(c);
            return (
              <li key={c.stagiaireId}>
                <button
                  type="button"
                  onClick={() => setAgrandi(c.stagiaireId)}
                  className={`flex w-full flex-col gap-2.5 rounded-[14px] border p-3 text-left shadow-repos transition-colors hover:border-ink ${COULEURS[c.gravite]}`}
                >
                  <span className="flex items-center gap-2.5">
                    <Avatar nom={c.nom} prenom="" photo={c.photo} taille="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-semibold text-ink">
                        {c.nom}
                        {c.estTest ? " (test)" : ""}
                      </span>
                      <span className="flex items-center gap-1.5 text-[13px] text-slate">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${PASTILLES[c.gravite]}`}
                          aria-hidden
                        />
                        {LIBELLES_ETAT[c.etat]}
                        {c.collages > 0
                          ? ` · ${c.collages} collage${c.collages > 1 ? "s" : ""}`
                          : ""}
                      </span>
                    </span>
                  </span>

                  <span className="block overflow-hidden rounded-[10px] bg-wash-strong">
                    {image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={image}
                        alt={`Écran de ${c.nom}`}
                        className="block aspect-video w-full object-cover object-top"
                      />
                    ) : (
                      <span className="flex aspect-video w-full items-center justify-center text-[13px] text-slate">
                        Pas encore d&apos;image
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Le grand format : une seule chose à l'écran, et les flèches pour
        passer au suivant. On y reste, on ne revient pas à la grille entre
        deux stagiaires.
      */}
      {grand ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Écran de ${grand.nom}`}
          className="fixed inset-0 z-50 flex flex-col gap-3 bg-ink/95 p-3 md:p-5"
        >
          <div className="flex items-center gap-3">
            <Avatar nom={grand.nom} prenom="" photo={grand.photo} taille="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold text-white">
                {grand.nom}
              </span>
              <span className="text-[13px] text-white/70">
                {LIBELLES_ETAT[grand.etat]} · {index + 1} sur {cartes.length}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              onClick={() => glisser(-1)}
              aria-label="Stagiaire précédent"
            >
              Précédent
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconRight={ChevronRight}
              onClick={() => glisser(1)}
              aria-label="Stagiaire suivant"
            >
              Suivant
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={X}
              onClick={() => setAgrandi(null)}
              aria-label="Fermer"
            >
              Fermer
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center">
            {url(grand, ticGrand) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={url(grand, ticGrand)!}
                alt={`Écran de ${grand.nom}`}
                className="h-full w-full rounded-[10px] object-contain"
              />
            ) : (
              <p className="text-[15px] text-white/70">
                {grand.nom} n&apos;a pas encore partagé son écran.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmeEffacement}
        title="Effacer les captures de ce contrôle ?"
        message={`Les images d'écran et le journal de « ${controleTitre} » seront supprimés définitivement. À faire une fois l'épreuve corrigée : ce sont les écrans de vos stagiaires, ils n'ont pas à rester.`}
        confirmLabel="Effacer"
        onConfirm={() => void effacer()}
        onClose={() => setConfirmeEffacement(false)}
        busy={efface}
      />
    </div>
  );
}
