"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  LayoutTemplate,
  List,
  ListOrdered,
  Table2,
} from "lucide-react";
import { GABARITS } from "@/lib/gabarits-reponse";
import { versHtml, versMarkdown } from "@/lib/markdown-visuel";
import { analyser, versBloc, SCHEMA_VIDE, type Schema } from "@/lib/schema-reponse";
import { svgDuSchema } from "@/lib/schema-svg";
import CanevasSchema from "@/components/CanevasSchema";
import { PenTool } from "lucide-react";

/**
 * La copie du stagiaire, composée à l'écran telle qu'elle sera rendue.
 *
 * Un contrôle de M202 demande une fiche persona, une empathy map, une user
 * journey map. Un `textarea` obligeait à compter des barres verticales sous
 * le chronomètre ; une zone Markdown avec aperçu laissait encore des `|` et
 * des `**` sous les yeux de quelqu'un qui n'a pas à les connaître. Ici, un
 * tableau est un tableau : on clique dans une case et on écrit.
 *
 * Ce qui part en base reste du Markdown. Toute la chaîne existante le
 * consomme ainsi — correction par l'IA, PDF de la copie, affichage au
 * formateur — et la changer n'aurait rien apporté à celui qui écrit. La
 * conversion se fait ici, à chaque frappe, et le stagiaire n'en voit rien.
 *
 * `document.execCommand` est officiellement déprécié et reste la seule
 * manière universellement gérée de mettre en gras la sélection d'une zone
 * éditable. Les navigateurs continuent de l'implémenter précisément parce
 * qu'aucun remplaçant n'existe.
 */
export default function ChampReponseVisuel({
  id,
  valeur,
  onChange,
  minRows,
  placeholder,
  ariaLabel,
  disabled = false,
}: {
  id: string;
  valeur: string;
  onChange: (valeur: string) => void;
  minRows: number;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [gabarits, setGabarits] = useState(false);
  // Où se trouve le curseur dans le tableau. « Dedans » ne suffisait pas :
  // les suppressions dépendent de la ligne et de la colonne, et surtout il
  // faut pouvoir dire POURQUOI une suppression est impossible.
  const [place, setPlace] = useState<{
    dedans: boolean;
    entete: boolean;
    colonnes: number;
    lignesCorps: number;
  }>({ dedans: false, entete: false, colonnes: 0, lignesCorps: 0 });
  // Le schéma en cours d'édition : son contenu, et la figure du document qu'il
  // remplacera en sortant. `null` quand le canevas est fermé.
  const [schemaOuvert, setSchemaOuvert] = useState<Schema | null>(null);
  const figureVisee = useRef<HTMLElement | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  // Le dernier Markdown que nous avons nous-mêmes produit. Il sert à
  // distinguer une valeur qui revient de l'extérieur — copie reprise, remise
  // à zéro — d'un écho de notre propre frappe : regarnir la zone à chaque
  // caractère y replacerait le curseur au début.
  const dernierEmis = useRef<string | null>(null);

  useEffect(() => {
    const el = zone.current;
    if (!el || valeur === dernierEmis.current) return;
    el.innerHTML = versHtml(valeur);
    dernierEmis.current = valeur;
  }, [valeur]);

  const emettre = useCallback(() => {
    const el = zone.current;
    if (!el) return;
    const markdown = versMarkdown(el);
    dernierEmis.current = markdown;
    onChange(markdown);
  }, [onChange]);

  /** Le tableau qui contient le curseur, s'il y en a un. */
  const tableauCourant = useCallback((): HTMLTableElement | null => {
    const selection = document.getSelection();
    const noeud = selection?.anchorNode ?? null;
    if (!noeud || !zone.current?.contains(noeud)) return null;
    const depart =
      noeud.nodeType === Node.ELEMENT_NODE
        ? (noeud as Element)
        : noeud.parentElement;
    return depart?.closest("table") ?? null;
  }, []);

  /** La cellule qui contient le curseur, s'il y en a une. */
  const celluleCourante = useCallback((): HTMLTableCellElement | null => {
    const selection = document.getSelection();
    const noeud = selection?.anchorNode ?? null;
    if (!noeud || !zone.current?.contains(noeud)) return null;
    const depart =
      noeud.nodeType === Node.ELEMENT_NODE
        ? (noeud as Element)
        : noeud.parentElement;
    return (depart?.closest("td, th") as HTMLTableCellElement) ?? null;
  }, []);

  const suivreCurseur = useCallback(() => {
    const table = tableauCourant();
    const cellule = celluleCourante();
    setPlace({
      dedans: Boolean(table),
      entete: cellule?.tagName === "TH",
      colonnes: table?.querySelectorAll("thead th, tr:first-child > *").length ?? 0,
      lignesCorps: table?.querySelectorAll("tbody tr").length ?? 0,
    });
  }, [tableauCourant, celluleCourante]);

  useEffect(() => {
    document.addEventListener("selectionchange", suivreCurseur);
    return () => document.removeEventListener("selectionchange", suivreCurseur);
  }, [suivreCurseur]);

  useEffect(() => {
    if (!gabarits) return;
    const dehors = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setGabarits(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGabarits(false);
    };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [gabarits]);

  /** Applique une commande de mise en forme à la sélection. */
  function commande(nom: string) {
    const el = zone.current;
    if (!el || disabled) return;
    el.focus();
    document.execCommand(nom);
    emettre();
  }

  /**
   * Insère un fragment au curseur, et y place le point d'insertion.
   *
   * Le fragment vient du Markdown d'un gabarit : on le convertit, puis on
   * pose le curseur dans la première case du premier tableau, qui est
   * l'endroit où l'on va écrire.
   */
  function insererHtml(html: string) {
    const el = zone.current;
    if (!el || disabled) return;
    el.focus();

    const selection = document.getSelection();
    const modele = document.createElement("div");
    modele.innerHTML = html;
    const noeuds = Array.from(modele.children) as HTMLElement[];

    // L'insertion se fait entre les blocs, jamais dedans. Posé au curseur, un
    // tableau atterrissait à l'intérieur du paragraphe courant — `<p><table>`,
    // que le navigateur referme n'importe comment et que la sérialisation
    // perd. On repère donc le bloc de premier niveau qui contient le curseur,
    // et on se place après lui.
    const ancre = (() => {
      const noeud = selection?.anchorNode ?? null;
      if (!noeud || !el.contains(noeud)) return null;
      let courant: Node | null = noeud;
      while (courant && courant.parentNode !== el) courant = courant.parentNode;
      return courant as HTMLElement | null;
    })();

    if (ancre) {
      let apres: Node = ancre;
      for (const n of noeuds) {
        apres.parentNode?.insertBefore(n, apres.nextSibling);
        apres = n;
      }
      // Un paragraphe vide laissé par le curseur n'a plus lieu d'être.
      if (ancre.tagName === "P" && (ancre.textContent ?? "").trim() === "") {
        ancre.remove();
      }
    } else {
      noeuds.forEach((n) => el.appendChild(n));
    }

    // Un paragraphe de sortie après un bloc qui n'accueille pas le curseur :
    // sans lui, un tableau ou un schéma en fin de zone l'y enferme, et le
    // stagiaire ne peut plus rien écrire en dessous.
    const dernier = el.lastElementChild;
    if (dernier?.tagName === "TABLE" || dernier?.tagName === "FIGURE") {
      const sortie = document.createElement("p");
      sortie.appendChild(document.createElement("br"));
      el.appendChild(sortie);
    }

    // La première case du CORPS, et non l'en-tête : les intitulés sont déjà
    // écrits, c'est la première ligne de données qu'on vient remplir.
    const premiere = noeuds
      .map((n) => n.querySelector("tbody td") ?? n.querySelector("td"))
      .find(Boolean);
    if (premiere) {
      const plage = document.createRange();
      plage.selectNodeContents(premiere);
      plage.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(plage);
    }

    emettre();
  }

  function ajouterLigne() {
    const table = tableauCourant();
    const corps = table?.querySelector("tbody") ?? table;
    const modele = table?.querySelector("tbody tr") ?? table?.querySelector("tr");
    if (!table || !corps || !modele) return;
    const ligne = document.createElement("tr");
    for (let i = 0; i < modele.children.length; i += 1) {
      const c = document.createElement("td");
      c.appendChild(document.createElement("br"));
      ligne.appendChild(c);
    }
    corps.appendChild(ligne);
    emettre();
  }

  function ajouterColonne() {
    const table = tableauCourant();
    if (!table) return;
    for (const tr of Array.from(table.querySelectorAll("tr"))) {
      const dansEntete = tr.parentElement?.tagName === "THEAD";
      const c = document.createElement(dansEntete ? "th" : "td");
      c.appendChild(document.createElement("br"));
      tr.appendChild(c);
    }
    emettre();
  }

  function supprimerColonne() {
    const table = tableauCourant();
    const cellule = celluleCourante();
    if (!table || !cellule) return;
    const rang = Array.from(cellule.parentElement?.children ?? []).indexOf(cellule);
    if (rang < 0) return;
    for (const tr of Array.from(table.querySelectorAll("tr"))) {
      tr.children[rang]?.remove();
    }
    emettre();
  }

  function supprimerLigne() {
    const selection = document.getSelection();
    const noeud = selection?.anchorNode ?? null;
    const depart =
      noeud?.nodeType === Node.ELEMENT_NODE
        ? (noeud as Element)
        : (noeud?.parentElement ?? null);
    const tr = depart?.closest("tr");
    // On ne retire pas l'en-tête : un tableau sans en-tête n'est plus un
    // tableau au moment de l'enregistrer.
    if (!tr || tr.parentElement?.tagName === "THEAD") return;
    tr.remove();
    emettre();
  }

  /** Ouvre le canevas, sur un schéma existant ou sur une page blanche. */
  function ouvrirCanevas(figure: HTMLElement | null) {
    figureVisee.current = figure;
    setSchemaOuvert(
      (figure?.dataset.schema ? analyser(figure.dataset.schema) : null) ??
        SCHEMA_VIDE,
    );
  }

  /** Repose le schéma dans le document, à la place de celui qu'on éditait. */
  function fermerCanevas(schema: Schema | null) {
    const el = zone.current;
    if (schema && el) {
      const html = `<figure data-schema="${JSON.stringify(schema).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")}" contenteditable="false">${svgDuSchema(schema)}</figure>`;
      const existante = figureVisee.current;
      if (existante && el.contains(existante)) {
        const modele = document.createElement("div");
        modele.innerHTML = html;
        existante.replaceWith(modele.firstElementChild!);
      } else {
        insererHtml(html);
      }
      if (el.lastElementChild?.tagName === "FIGURE") {
        const sortie = document.createElement("p");
        sortie.appendChild(document.createElement("br"));
        el.appendChild(sortie);
      }
      emettre();
    }
    figureVisee.current = null;
    setSchemaOuvert(null);
  }

  const outils = [
    { libelle: "Gras", Icone: Bold, agir: () => commande("bold") },
    { libelle: "Italique", Icone: Italic, agir: () => commande("italic") },
    {
      libelle: "Liste à puces",
      Icone: List,
      agir: () => commande("insertUnorderedList"),
    },
    {
      libelle: "Liste numérotée",
      Icone: ListOrdered,
      agir: () => commande("insertOrderedList"),
    },
    {
      libelle: "Tableau",
      Icone: Table2,
      agir: () => insererHtml(versHtml(GABARITS[0]!.bloc)),
    },
    {
      libelle: "Schéma — user flow, wireframe",
      Icone: PenTool,
      agir: () => ouvrirCanevas(null),
    },
  ];

  const vide = valeur.trim() === "";
  const mots = vide ? 0 : valeur.trim().split(/\s+/).length;

  return (
    // Pas d'`overflow-hidden` ici : il rognait le menu des gabarits, qui
    // déborde du cadre par construction. Les coins se tiennent donc sur les
    // deux bandes elles-mêmes.
    <div className="rounded-[12px] border border-border-strong bg-surface focus-within:border-ink">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-[11px] border-b border-separator bg-paper-alt px-2 py-1.5">
        {outils.map(({ libelle, Icone, agir }) => (
          <button
            key={libelle}
            type="button"
            // `onMouseDown` et non `onClick` : un clic ordinaire sort d'abord
            // de la zone éditable, et la sélection à mettre en gras est perdue
            // avant que la commande ne s'exécute.
            onMouseDown={(e) => {
              e.preventDefault();
              agir();
            }}
            title={libelle}
            aria-label={libelle}
            disabled={disabled}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-slate-2 transition-colors duration-150 ease-out hover:bg-wash hover:text-ink disabled:opacity-60 md:h-8 md:w-8"
          >
            <Icone className="h-4 w-4" aria-hidden />
          </button>
        ))}

        <div className="relative" ref={menu}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setGabarits((o) => !o);
            }}
            disabled={disabled}
            aria-expanded={gabarits}
            aria-haspopup="menu"
            className="flex h-11 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold text-slate-2 transition-colors duration-150 ease-out hover:bg-wash hover:text-ink disabled:opacity-60 md:h-8"
          >
            <LayoutTemplate className="h-4 w-4" aria-hidden />
            Gabarits
          </button>

          {gabarits ? (
            <div
              role="menu"
              className="absolute left-0 top-full z-20 mt-1 max-h-[min(60vh,340px)] w-[280px] overflow-y-auto overscroll-contain rounded-[10px] border border-border bg-surface shadow-eleve"
            >
              {GABARITS.map((g) => (
                <button
                  key={g.cle}
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insererHtml(versHtml(g.bloc));
                    setGabarits(false);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-separator px-3.5 py-2.5 text-left last:border-b-0 hover:bg-paper"
                >
                  <span className="text-[14px] font-semibold text-ink">
                    {g.libelle}
                  </span>
                  <span className="text-[12.5px] leading-snug text-slate">
                    {g.aide}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Les outils de tableau n'apparaissent que le curseur dedans : hors
            d'un tableau ils n'auraient rien à faire, et les montrer grisés
            encombrerait une barre déjà chargée sur téléphone. */}
        {place.dedans ? (
          <div className="ml-1 flex flex-wrap items-center gap-1 border-l border-separator pl-2">
            {/*
              Des libellés, pas des icônes. Quatre pictogrammes de tableau se
              ressemblent tous, et on ne survole pas une infobulle au doigt :
              ces boutons étaient là depuis le début sans que personne les
              trouve.
            */}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-light">
              Tableau
            </span>
            {[
              { libelle: "+ ligne", titre: "Ajouter une ligne", agir: ajouterLigne, empeche: null },
              {
                libelle: "+ colonne",
                titre: "Ajouter une colonne",
                agir: ajouterColonne,
                empeche: null,
              },
              {
                libelle: "− ligne",
                titre: "Supprimer la ligne où est le curseur",
                agir: supprimerLigne,
                // Un bouton qui ne fait rien sans rien dire est pire qu'un
                // bouton absent : on refusait en silence quand le curseur
                // était dans l'en-tête, qui est le premier endroit où l'on
                // écrit. Le refus se dit maintenant, à la place.
                empeche: place.entete
                  ? "Placez le curseur dans une ligne du tableau, pas dans l'en-tête."
                  : place.lignesCorps <= 1
                    ? "C'est la dernière ligne : un tableau en garde au moins une."
                    : null,
              },
              {
                libelle: "− colonne",
                titre: "Supprimer la colonne où est le curseur",
                agir: supprimerColonne,
                empeche:
                  place.colonnes <= 1
                    ? "C'est la dernière colonne : un tableau en garde au moins une."
                    : null,
              },
            ].map(({ libelle, titre, agir, empeche }) => (
              <button
                key={libelle}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!empeche) agir();
                }}
                title={empeche ?? titre}
                aria-label={titre}
                aria-disabled={Boolean(empeche)}
                disabled={disabled}
                className={`flex h-11 items-center rounded-[8px] px-2.5 text-[13px] font-semibold transition-colors duration-150 ease-out md:h-8 ${
                  empeche
                    ? "cursor-not-allowed text-muted"
                    : "text-slate-2 hover:bg-wash hover:text-ink"
                } disabled:opacity-60`}
              >
                {libelle}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative">
        {vide ? (
          <p className="pointer-events-none absolute left-4 top-3 text-[16px] leading-[1.75] text-muted md:text-[15px]">
            {placeholder}
          </p>
        ) : null}

        <div
          id={id}
          ref={zone}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          onInput={emettre}
          onBlur={emettre}
          // Un schéma ne se modifie pas au clavier : on le rouvre là où il a
          // été fait. Le double-clic est le geste qu'on tente d'instinct sur
          // une image qu'on veut reprendre.
          onDoubleClick={(e) => {
            const figure = (e.target as Element).closest?.("figure[data-schema]");
            if (figure) ouvrirCanevas(figure as HTMLElement);
          }}
          // Un collage apporte le balisage du site d'origine — polices,
          // couleurs, tableaux imbriqués — que la sérialisation ne saurait
          // rendre. On ne garde que le texte.
          onPaste={(e) => {
            e.preventDefault();
            const texte = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, texte);
            emettre();
          }}
          style={{ minHeight: `${Math.max(minRows, 3) * 22}px` }}
          className={[
            "px-4 py-3 text-[16px] leading-[1.75] text-ink outline-none md:text-[15px]",
            "[&_p]:my-2 [&_p:first-child]:mt-0",
            "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
            "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
            "[&_li]:my-1",
            "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-[8px]",
            "[&_th]:border [&_th]:border-separator [&_th]:bg-[var(--encre,#2e3b4e)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[13.5px] [&_th]:font-medium [&_th]:text-white",
            "[&_td]:border [&_td]:border-separator [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-[14.5px]",
            "[&_strong]:font-semibold",
            "[&_figure]:my-3 [&_figure]:cursor-pointer [&_figure]:overflow-hidden [&_figure]:rounded-[10px] [&_figure]:border [&_figure]:border-border [&_figure]:bg-paper-alt",
          ].join(" ")}
        />
      </div>

      {schemaOuvert ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Dessiner un schéma"
          className="fixed inset-0 z-50 flex flex-col bg-ink/60 p-2 md:p-6"
        >
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[12px] border border-border bg-surface shadow-eleve">
            <CanevasSchema
              depart={schemaOuvert}
              onValider={(s) => fermerCanevas(s)}
              onAnnuler={() => fermerCanevas(null)}
            />
          </div>
        </div>
      ) : null}

      <p className="rounded-b-[11px] border-t border-separator bg-paper-alt px-4 py-1.5 text-right text-[12px] text-slate-light">
        {mots > 0 ? `${mots} mot${mots > 1 ? "s" : ""}` : " "}
      </p>
    </div>
  );
}
