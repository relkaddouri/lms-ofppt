"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Diamond,
  Eraser,
  Maximize2,
  Minimize2,
  MousePointer2,
  Pencil,
  RectangleHorizontal,
  Spline,
  StickyNote,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import {
  HAUTEUR_CANEVAS,
  LARGEUR_CANEVAS,
  SCHEMA_VIDE,
  type Forme,
  type Schema,
  type TypeForme,
} from "@/lib/schema-reponse";
import {
  COULEURS,
  centre,
  cheminTrait,
  extremites,
  lignesDuTexte,
} from "@/lib/schema-svg";

/**
 * Le canevas où le stagiaire dessine un user flow ou un wireframe.
 *
 * Des formes qui portent un nom, et des flèches entre elles : c'est ce qui
 * rend le schéma corrigeable sans vision, puisque la correction en reçoit la
 * description écrite. Le crayon reste là pour annoter — il ne se décrit pas,
 * et le correcteur en est prévenu.
 *
 * Tout se fait en SVG, dans un repère fixe de 1000 × 620 : le dessin garde
 * donc les mêmes proportions sur un portable, dans la copie, et en plein
 * écran. Aucune bibliothèque de dessin : elles pèsent plus que toute la page
 * de passation, qu'un stagiaire charge parfois sur un réseau d'établissement.
 */

type Outil = "selection" | "bloc" | "decision" | "note" | "fleche" | "crayon" | "gomme";

const OUTILS: { cle: Outil; libelle: string; Icone: typeof MousePointer2 }[] = [
  { cle: "selection", libelle: "Sélectionner et déplacer", Icone: MousePointer2 },
  { cle: "bloc", libelle: "Écran", Icone: RectangleHorizontal },
  { cle: "decision", libelle: "Décision", Icone: Diamond },
  { cle: "note", libelle: "Note", Icone: StickyNote },
  { cle: "fleche", libelle: "Flèche", Icone: Spline },
  { cle: "crayon", libelle: "Crayon", Icone: Pencil },
  { cle: "gomme", libelle: "Gomme", Icone: Eraser },
];

const TAILLES: Record<TypeForme, { w: number; h: number }> = {
  bloc: { w: 170, h: 66 },
  decision: { w: 190, h: 84 },
  note: { w: 150, h: 56 },
};

const identifiant = () => Math.random().toString(36).slice(2, 9);

export default function CanevasSchema({
  depart,
  onValider,
  onAnnuler,
}: {
  depart: Schema;
  onValider: (schema: Schema) => void;
  onAnnuler: () => void;
}) {
  const [schema, setSchema] = useState<Schema>(depart ?? SCHEMA_VIDE);
  const [outil, setOutil] = useState<Outil>("bloc");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [depuis, setDepuis] = useState<string | null>(null);
  const [pleinEcran, setPleinEcran] = useState(false);

  const cadre = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const deplacement = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const traitEnCours = useRef<string | null>(null);
  // Les états précédents, pour défaire. Une pile courte suffit : on dessine,
  // on se trompe, on revient d'un ou deux pas — pas d'un quart d'heure.
  const historique = useRef<Schema[]>([]);

  const noter = useCallback((suite: Schema) => {
    setSchema((avant) => {
      historique.current = [...historique.current.slice(-19), avant];
      return suite;
    });
  }, []);

  const defaire = useCallback(() => {
    const precedent = historique.current.pop();
    if (precedent) setSchema(precedent);
  }, []);

  /** Le point du repère du schéma sous le pointeur. */
  const point = useCallback((e: { clientX: number; clientY: number }) => {
    const el = svg.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - r.left) / r.width) * LARGEUR_CANEVAS),
      y: Math.round(((e.clientY - r.top) / r.height) * HAUTEUR_CANEVAS),
    };
  }, []);

  // Le plein écran suit l'état du navigateur, et non l'inverse : la touche
  // Échap en sort sans passer par notre bouton, et l'icône doit le refléter.
  useEffect(() => {
    const suivre = () => setPleinEcran(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", suivre);
    return () => document.removeEventListener("fullscreenchange", suivre);
  }, []);

  async function basculerPleinEcran() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await cadre.current?.requestFullscreen();
    } catch {
      // Refusé — iPhone ne connaît pas le plein écran sur un élément. On
      // reste dans la page, qui fonctionne de la même façon.
    }
  }

  const formeChoisie = schema.formes.find((f) => f.id === choisi) ?? null;
  const flecheChoisie = schema.fleches.find((f) => f.id === choisi) ?? null;

  function poser(type: TypeForme, x: number, y: number) {
    const t = TAILLES[type];
    const forme: Forme = {
      id: identifiant(),
      type,
      texte: "",
      x: Math.max(0, Math.min(LARGEUR_CANEVAS - t.w, x - t.w / 2)),
      y: Math.max(0, Math.min(HAUTEUR_CANEVAS - t.h, y - t.h / 2)),
      ...t,
    };
    noter({ ...schema, formes: [...schema.formes, forme] });
    setChoisi(forme.id);
    setOutil("selection");
    // Le champ prend le focus : on vient de poser un écran, on va le nommer.
    window.setTimeout(() => champ.current?.focus(), 0);
  }

  function surFond(e: React.PointerEvent) {
    const p = point(e);
    if (outil === "bloc" || outil === "decision" || outil === "note") {
      poser(outil, p.x, p.y);
      return;
    }
    if (outil === "crayon") {
      const id = identifiant();
      traitEnCours.current = id;
      noter({ ...schema, traits: [...schema.traits, { id, points: [p.x, p.y] }] });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    setChoisi(null);
    setDepuis(null);
  }

  function surMouvement(e: React.PointerEvent) {
    const p = point(e);

    if (traitEnCours.current) {
      const id = traitEnCours.current;
      setSchema((s) => ({
        ...s,
        traits: s.traits.map((t) =>
          t.id === id ? { ...t, points: [...t.points, p.x, p.y] } : t,
        ),
      }));
      return;
    }

    const d = deplacement.current;
    if (!d) return;
    setSchema((s) => ({
      ...s,
      formes: s.formes.map((f) =>
        f.id === d.id
          ? {
              ...f,
              x: Math.max(0, Math.min(LARGEUR_CANEVAS - f.w, p.x - d.dx)),
              y: Math.max(0, Math.min(HAUTEUR_CANEVAS - f.h, p.y - d.dy)),
            }
          : f,
      ),
    }));
  }

  function surRelachement() {
    traitEnCours.current = null;
    deplacement.current = null;
  }

  function surForme(e: React.PointerEvent, forme: Forme) {
    e.stopPropagation();

    if (outil === "gomme") {
      noter({
        ...schema,
        formes: schema.formes.filter((f) => f.id !== forme.id),
        fleches: schema.fleches.filter(
          (f) => f.de !== forme.id && f.vers !== forme.id,
        ),
      });
      setChoisi(null);
      return;
    }

    if (outil === "fleche") {
      if (!depuis) {
        setDepuis(forme.id);
      } else if (depuis !== forme.id) {
        noter({
          ...schema,
          fleches: [
            ...schema.fleches,
            { id: identifiant(), de: depuis, vers: forme.id, texte: "" },
          ],
        });
        setDepuis(null);
      } else {
        setDepuis(null);
      }
      return;
    }

    setChoisi(forme.id);
    setDepuis(null);
    if (outil === "selection") {
      const p = point(e);
      deplacement.current = { id: forme.id, dx: p.x - forme.x, dy: p.y - forme.y };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      historique.current = [...historique.current.slice(-19), schema];
    }
  }

  function renommer(texte: string) {
    if (formeChoisie) {
      setSchema((s) => ({
        ...s,
        formes: s.formes.map((f) => (f.id === choisi ? { ...f, texte } : f)),
      }));
    } else if (flecheChoisie) {
      setSchema((s) => ({
        ...s,
        fleches: s.fleches.map((f) => (f.id === choisi ? { ...f, texte } : f)),
      }));
    }
  }

  function supprimerChoisi() {
    if (!choisi) return;
    noter({
      formes: schema.formes.filter((f) => f.id !== choisi),
      fleches: schema.fleches.filter(
        (f) => f.id !== choisi && f.de !== choisi && f.vers !== choisi,
      ),
      traits: schema.traits.filter((t) => t.id !== choisi),
    });
    setChoisi(null);
  }

  const aide =
    outil === "fleche"
      ? depuis
        ? "Cliquez maintenant la forme d'arrivée."
        : "Cliquez la forme de départ, puis celle d'arrivée."
      : outil === "gomme"
        ? "Cliquez un élément pour le retirer."
        : outil === "crayon"
          ? "Tracez à main levée. Le correcteur automatique ne lit pas ces traits."
          : outil === "selection"
            ? "Cliquez un élément pour le nommer, glissez pour le déplacer."
            : "Cliquez dans le cadre pour poser l'élément.";

  return (
    <div
      ref={cadre}
      className="flex h-full flex-col gap-2 bg-surface p-2 md:p-3"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {OUTILS.map(({ cle, libelle, Icone }) => (
          <button
            key={cle}
            type="button"
            onClick={() => {
              setOutil(cle);
              setDepuis(null);
            }}
            title={libelle}
            aria-label={libelle}
            aria-pressed={outil === cle}
            className={`flex h-11 w-11 items-center justify-center rounded-[8px] border transition-colors duration-150 ease-out md:h-9 md:w-9 ${
              outil === cle
                ? "border-ink bg-ink text-white"
                : "border-transparent text-slate-2 hover:bg-wash hover:text-ink"
            }`}
          >
            <Icone className="h-4 w-4" aria-hidden />
          </button>
        ))}

        <span className="mx-1 h-6 w-px bg-separator" aria-hidden />

        <button
          type="button"
          onClick={defaire}
          title="Défaire"
          aria-label="Défaire"
          className="flex h-11 w-11 items-center justify-center rounded-[8px] text-slate-2 transition-colors duration-150 ease-out hover:bg-wash hover:text-ink md:h-9 md:w-9"
        >
          <Undo2 className="h-4 w-4" aria-hidden />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={pleinEcran ? Minimize2 : Maximize2}
            onClick={() => void basculerPleinEcran()}
          >
            {pleinEcran ? "Réduire" : "Plein écran"}
          </Button>
          <Button variant="secondary" size="sm" icon={X} onClick={onAnnuler}>
            Annuler
          </Button>
          <Button size="sm" icon={Check} onClick={() => onValider(schema)}>
            Terminer
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[10px] border border-border bg-paper-alt">
        <svg
          ref={svg}
          viewBox={`0 0 ${LARGEUR_CANEVAS} ${HAUTEUR_CANEVAS}`}
          className="h-full w-full touch-none"
          onPointerDown={surFond}
          onPointerMove={surMouvement}
          onPointerUp={surRelachement}
          onPointerLeave={surRelachement}
        >
          <defs>
            <marker
              id="pointe-vive"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
            <pattern id="grille" width="25" height="25" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#cbd5e1" opacity="0.5" />
            </pattern>
          </defs>

          <rect width={LARGEUR_CANEVAS} height={HAUTEUR_CANEVAS} fill="url(#grille)" />

          {schema.fleches.map((fl) => {
            const e = extremites(schema, fl);
            if (!e) return null;
            const mx = (e.depart.x + e.arrivee.x) / 2;
            const my = (e.depart.y + e.arrivee.y) / 2;
            return (
              <g
                key={fl.id}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (outil === "gomme") {
                    noter({
                      ...schema,
                      fleches: schema.fleches.filter((x) => x.id !== fl.id),
                    });
                    return;
                  }
                  setChoisi(fl.id);
                }}
                className="cursor-pointer"
              >
                <line
                  x1={e.depart.x}
                  y1={e.depart.y}
                  x2={e.arrivee.x}
                  y2={e.arrivee.y}
                  stroke={choisi === fl.id ? "#2e7d9e" : "#64748b"}
                  strokeWidth={choisi === fl.id ? 2.6 : 1.6}
                  markerEnd="url(#pointe-vive)"
                />
                {/* Une ligne fine se clique mal : une seconde, transparente et
                    épaisse, élargit la cible sans se voir. */}
                <line
                  x1={e.depart.x}
                  y1={e.depart.y}
                  x2={e.arrivee.x}
                  y2={e.arrivee.y}
                  stroke="transparent"
                  strokeWidth={16}
                />
                {fl.texte.trim() ? (
                  <>
                    <rect
                      x={mx - fl.texte.trim().length * 3.4 - 4}
                      y={my - 9}
                      width={fl.texte.trim().length * 6.8 + 8}
                      height={16}
                      rx={3}
                      fill="#ffffff"
                      opacity={0.92}
                    />
                    <text x={mx} y={my + 3} textAnchor="middle" fontSize={11} fill="#475569">
                      {fl.texte.trim()}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}

          {schema.formes.map((f) => {
            const c = COULEURS[f.type];
            const lignes = lignesDuTexte(f.texte, f.w);
            const hauteurTexte = lignes.length * 16;
            const y0 = f.y + f.h / 2 - hauteurTexte / 2 + 12;
            const vif = choisi === f.id || depuis === f.id;
            return (
              <g
                key={f.id}
                onPointerDown={(e) => surForme(e, f)}
                className={outil === "selection" ? "cursor-move" : "cursor-pointer"}
              >
                {f.type === "decision" ? (
                  <polygon
                    points={`${f.x + f.w / 2},${f.y} ${f.x + f.w},${f.y + f.h / 2} ${f.x + f.w / 2},${f.y + f.h} ${f.x},${f.y + f.h / 2}`}
                    fill={c.fond}
                    stroke={vif ? "#2e7d9e" : c.trait}
                    strokeWidth={vif ? 2.6 : 1.5}
                  />
                ) : (
                  <rect
                    x={f.x}
                    y={f.y}
                    width={f.w}
                    height={f.h}
                    rx={8}
                    fill={c.fond}
                    stroke={vif ? "#2e7d9e" : c.trait}
                    strokeWidth={vif ? 2.6 : 1.5}
                    strokeDasharray={f.type === "note" ? "5 4" : undefined}
                  />
                )}
                {lignes.length === 0 ? (
                  <text
                    x={f.x + f.w / 2}
                    y={f.y + f.h / 2 + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fill="#94a3b8"
                    fontStyle="italic"
                  >
                    sans titre
                  </text>
                ) : (
                  lignes.map((l, i) => (
                    <text
                      key={i}
                      x={f.x + f.w / 2}
                      y={y0 + i * 16}
                      textAnchor="middle"
                      fontSize={13}
                      fill={c.texte}
                    >
                      {l}
                    </text>
                  ))
                )}
              </g>
            );
          })}

          {schema.traits.map((t) => (
            <path
              key={t.id}
              d={cheminTrait(t.points)}
              fill="none"
              stroke={choisi === t.id ? "#2e7d9e" : "#2e3b4e"}
              strokeWidth={choisi === t.id ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (outil === "gomme") {
                  noter({ ...schema, traits: schema.traits.filter((x) => x.id !== t.id) });
                  return;
                }
                setChoisi(t.id);
              }}
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {formeChoisie || flecheChoisie ? (
          <>
            <label
              htmlFor="texte-element"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light"
            >
              {flecheChoisie ? "Condition" : "Nom"}
            </label>
            <input
              id="texte-element"
              ref={champ}
              value={(formeChoisie ?? flecheChoisie)?.texte ?? ""}
              onChange={(e) => renommer(e.target.value)}
              placeholder={
                flecheChoisie ? "oui, non, valider…" : "Accueil, Recherche, Paiement…"
              }
              className="min-w-0 flex-1 rounded-[8px] border border-border-strong bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-ink"
            />
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={supprimerChoisi}
            >
              Retirer
            </Button>
          </>
        ) : (
          <p className="text-[13.5px] text-slate">{aide}</p>
        )}
      </div>
    </div>
  );
}
