"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DiapoRedigee from "@/components/DiapoRedigee";
import { decouperEnDiapositives } from "@/lib/diapos";
import { decouperEnDiapos } from "@/lib/markdown";
import { estRedige } from "@/lib/support";
import Button from "@/components/ui/Button";
import type { SupportTheorique } from "@/lib/support";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Presentation,
} from "lucide-react";

type Diapo =
  | { type: "titre"; titre: string; sousTitre: string; intro: string }
  | {
      type: "section";
      numero: number;
      total: number;
      titre: string;
      notions: string[];
      exemple: string | null;
    }
  | { type: "schema"; titre: string; etapes: string[]; legende: string | null }
  | { type: "retenir"; points: string[] };

/**
 * Découpe le cours en diapositives.
 *
 * Une section trop fournie est scindée : au-delà de quatre notions, la
 * diapositive devient un mur de texte qu'on ne lit plus depuis le fond de la
 * salle. L'exemple part alors sur la diapositive suivante.
 */
function decouper(support: SupportTheorique, sousTitre: string): Diapo[] {
  const diapos: Diapo[] = [
    {
      type: "titre",
      titre: support.titre,
      sousTitre,
      intro: support.introduction,
    },
  ];

  const total = support.sections.length;
  // Un cours rédigé à la main se découpe sur ses titres markdown : chacun
  // ouvre une diapositive. C'est le seul aperçu que le formateur ait de son
  // texte, et c'est exactement ce que la classe verra — projeter du markdown
  // brut montrerait la source, ce que le §4.4 interdit.
  if (estRedige(support)) {
    decouperEnDiapos(support.markdown!, support.titre).forEach((d, i, tous) => {
      diapos.push({
        type: "section",
        numero: i + 1,
        total: tous.length,
        titre: d.titre,
        notions: d.points,
        exemple: null,
      });
    });
    return diapos;
  }

  support.sections.forEach((sec, i) => {
    const paquets: string[][] = [];
    for (let k = 0; k < sec.notions.length; k += 4) {
      paquets.push(sec.notions.slice(k, k + 4));
    }
    if (paquets.length === 0) paquets.push([]);

    paquets.forEach((notions, k) => {
      diapos.push({
        type: "section",
        numero: i + 1,
        total,
        titre: sec.titre,
        notions,
        // L'exemple accompagne le dernier paquet de la section.
        exemple: k === paquets.length - 1 ? sec.exemple : null,
      });
    });

    // La figure prend sa propre diapositive : la coller sous les notions
    // reconstitue le mur de texte que le découpage vient d'éviter.
    if (sec.schema) {
      diapos.push({
        type: "schema",
        titre: sec.schema.titre,
        etapes: sec.schema.etapes,
        legende: sec.schema.legende,
      });
    }
  });

  if (support.aRetenir.length > 0) {
    diapos.push({ type: "retenir", points: support.aRetenir });
  }
  return diapos;
}

export default function DiaporamaCours({
  support,
  sousTitre,
  pied,
}: {
  support: SupportTheorique;
  sousTitre: string;
  /** Ce que le pied de page répète — module, élément, nature du document. */
  pied?: string;
}) {
  // Un cours rédigé a sa propre grammaire de diapositives : couverture,
  // sommaire, intercalaires, contenu paginé. Elle est reprise du support de
  // référence du porteur de projet plutôt qu'inventée.
  const redigees = estRedige(support)
    ? decouperEnDiapositives(support.markdown!, {
        surtitre: pied ?? sousTitre,
        pied: pied ?? sousTitre,
      })
    : null;
  // Les deux jeux ne se mélangent pas : celui d'un cours structuré et celui
  // d'un cours rédigé n'ont ni les mêmes types de diapositive ni le même
  // rendu. Seul leur nombre est commun, pour la navigation.
  const classiques = redigees ? null : decouper(support, sousTitre);
  const nombre = redigees?.length ?? classiques!.length;
  const [index, setIndex] = useState(0);
  const [pleinEcran, setPleinEcran] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);

  const aller = useCallback(
    (delta: number) =>
      setIndex((i) => Math.min(nombre - 1, Math.max(0, i + delta))),
    [nombre],
  );

  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") aller(1);
      else if (e.key === "ArrowLeft") aller(-1);
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(nombre - 1);
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [aller, nombre]);

  useEffect(() => {
    function change() {
      setPleinEcran(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);

  async function basculerPleinEcran() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await cadre.current?.requestFullscreen();
  }

  const d = classiques?.[index];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={pleinEcran ? Minimize2 : Presentation}
          onClick={basculerPleinEcran}
        >
          Présenter en plein écran
        </Button>
        <span className="ml-auto font-mono text-xs text-slate">
          {index + 1} / {nombre}
        </span>
      </div>

      <div
        ref={cadre}
        className="mt-3 bg-ink"
        // En plein écran le cadre occupe l'écran ; sinon il garde le 16:9.
        style={
          pleinEcran
            ? { display: "grid", placeItems: "center", height: "100%" }
            : undefined
        }
      >
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: "16 / 9",
            containerType: "size",
            maxHeight: pleinEcran ? "100vh" : undefined,
            maxWidth: pleinEcran ? "min(100vw, calc(100vh * 16 / 9))" : undefined,
          }}
        >
          {redigees ? (
            <DiapoRedigee
              diapo={redigees[index]!}
              numero={index + 1}
              pied={pied ?? sousTitre}
            />
          ) : !d ? null : d.type === "titre" ? (
            <div className="flex h-full flex-col justify-center bg-ink px-[7cqw] text-white">
              <p
                className="font-mono uppercase tracking-widest text-mint/70"
                style={{ fontSize: "1.6cqw" }}
              >
                {d.sousTitre}
              </p>
              <h1
                className="mt-[2cqh] font-display font-bold leading-tight"
                style={{ fontSize: "5.2cqw" }}
              >
                {d.titre}
              </h1>
              <p
                className="mt-[3cqh] max-w-[62cqw] leading-relaxed text-mint/85"
                style={{ fontSize: "2cqw" }}
              >
                {d.intro}
              </p>
            </div>
          ) : d.type === "section" ? (
            <div className="flex h-full flex-col bg-surface px-[6cqw] py-[6cqh]">
              <div className="flex items-baseline gap-[1.5cqw]">
                <span
                  className="font-mono font-bold text-ink/40"
                  style={{ fontSize: "3.4cqw" }}
                >
                  {String(d.numero).padStart(2, "0")}
                </span>
                <h2
                  className="font-display font-bold leading-tight text-ink"
                  style={{ fontSize: "3.4cqw" }}
                >
                  {d.titre}
                </h2>
              </div>
              <div
                className="mt-[1cqh] h-[0.4cqh] w-[10cqw] rounded-full bg-ink"
                aria-hidden
              />

              <ul className="mt-[4cqh] flex-1 space-y-[2.4cqh]">
                {d.notions.map((n, i) => (
                  <li key={i} className="flex gap-[1.6cqw]">
                    <span
                      className="mt-[0.9cqh] h-[1cqh] w-[1cqh] shrink-0 rounded-full bg-ink"
                      aria-hidden
                    />
                    <span
                      className="leading-snug text-ink"
                      style={{ fontSize: "2.05cqw" }}
                    >
                      {n}
                    </span>
                  </li>
                ))}
              </ul>

              {d.exemple ? (
                <div className="mt-[2cqh] rounded-[1cqw] border-l-[0.6cqw] border-ink bg-wash px-[2.5cqw] py-[2cqh]">
                  <p
                    className="font-mono uppercase tracking-widest text-ink/70"
                    style={{ fontSize: "1.3cqw" }}
                  >
                    Exemple
                  </p>
                  <p
                    className="mt-[0.8cqh] leading-snug text-ink"
                    style={{ fontSize: "1.85cqw" }}
                  >
                    {d.exemple}
                  </p>
                </div>
              ) : null}
            </div>
          ) : d.type === "schema" ? (
            <div className="flex h-full flex-col justify-center bg-surface px-[6cqw] py-[6cqh]">
              <h2
                className="font-display font-bold leading-tight text-ink"
                style={{ fontSize: "3cqw" }}
              >
                {d.titre}
              </h2>
              <ol className="mt-[5cqh] flex flex-wrap items-center gap-[1.4cqw]">
                {d.etapes.map((e, i) => (
                  <li key={i} className="flex items-center gap-[1.4cqw]">
                    <span
                      className="rounded-[0.8cqw] border-[0.15cqw] border-ink bg-wash px-[2cqw] py-[1.6cqh] leading-snug text-ink"
                      style={{ fontSize: "1.9cqw" }}
                    >
                      {e}
                    </span>
                    {i < d.etapes.length - 1 ? (
                      <span
                        aria-hidden
                        className="font-bold text-ink/50"
                        style={{ fontSize: "2.2cqw" }}
                      >
                        →
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              {d.legende ? (
                <p
                  className="mt-[4cqh] leading-snug text-ink/70"
                  style={{ fontSize: "1.7cqw" }}
                >
                  {d.legende}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center bg-wash px-[7cqw]">
              <h2
                className="font-display font-bold text-ink"
                style={{ fontSize: "4cqw" }}
              >
                À retenir
              </h2>
              <ul className="mt-[4cqh] space-y-[2.6cqh]">
                {d.points.map((p, i) => (
                  <li key={i} className="flex gap-[1.8cqw]">
                    <span
                      className="font-mono font-bold text-ink/50"
                      style={{ fontSize: "2.2cqw" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="leading-snug text-ink"
                      style={{ fontSize: "2.2cqw" }}
                    >
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pied de diapositive, hors page de titre. Le rendu rédigé pose
              le sien. */}
          {d && d.type !== "titre" ? (
            <div className="absolute inset-x-[6cqw] bottom-[2.5cqh] flex items-center justify-between">
              <span
                className="truncate font-mono text-slate/70"
                style={{ fontSize: "1.3cqw" }}
              >
                {sousTitre}
              </span>
              <span
                className="font-mono text-slate/70"
                style={{ fontSize: "1.3cqw" }}
              >
                {index + 1} / {nombre}
              </span>
            </div>
          ) : null}

          {/* Commandes superposées, discrètes tant qu'on ne les survole pas. */}
          <div className="absolute inset-y-0 left-0 flex items-center opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={() => aller(-1)}
              disabled={index === 0}
              aria-label="Diapositive précédente"
              className="m-[1cqw] rounded-full bg-ink/60 p-[1cqw] text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-[2cqw] w-[2cqw]" />
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={() => aller(1)}
              disabled={index === nombre - 1}
              aria-label="Diapositive suivante"
              className="m-[1cqw] rounded-full bg-ink/60 p-[1cqw] text-white disabled:opacity-30"
            >
              <ChevronRight className="h-[2cqw] w-[2cqw]" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronLeft}
          onClick={() => aller(-1)}
          disabled={index === 0}
        >
          Précédente
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronRight}
          onClick={() => aller(1)}
          disabled={index === nombre - 1}
        >
          Suivante
        </Button>
        <span className="ml-auto text-xs text-slate">
          Flèches ← → pour naviguer
        </span>
      </div>
    </div>
  );
}
