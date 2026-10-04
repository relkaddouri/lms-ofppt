"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Columns3,
  Italic,
  LayoutTemplate,
  List,
  ListOrdered,
  Rows3,
  Table2,
  Trash2,
} from "lucide-react";
import { GABARITS } from "@/lib/gabarits-reponse";
import { versHtml, versMarkdown } from "@/lib/markdown-visuel";

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
  const [dansTableau, setDansTableau] = useState(false);
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

  const suivreCurseur = useCallback(() => {
    setDansTableau(Boolean(tableauCourant()));
  }, [tableauCourant]);

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

    // Un paragraphe de sortie après un tableau : sans lui, un tableau en fin
    // de zone enferme le curseur, et le stagiaire ne peut plus écrire après.
    const dernier = el.lastElementChild;
    if (dernier?.tagName === "TABLE") {
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
  ];

  const vide = valeur.trim() === "";
  const mots = vide ? 0 : valeur.trim().split(/\s+/).length;

  return (
    <div className="overflow-hidden rounded-[12px] border border-border-strong bg-surface focus-within:border-ink">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-separator bg-paper-alt px-2 py-1.5">
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
              className="absolute left-0 top-full z-20 mt-1 w-[280px] overflow-hidden rounded-[10px] border border-border bg-surface shadow-eleve"
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
        {dansTableau ? (
          <div className="ml-1 flex items-center gap-0.5 border-l border-separator pl-1.5">
            {[
              { libelle: "Ajouter une ligne", Icone: Rows3, agir: ajouterLigne },
              { libelle: "Ajouter une colonne", Icone: Columns3, agir: ajouterColonne },
              { libelle: "Supprimer la ligne", Icone: Trash2, agir: supprimerLigne },
            ].map(({ libelle, Icone, agir }) => (
              <button
                key={libelle}
                type="button"
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
            "[&_th]:border [&_th]:border-separator [&_th]:bg-ink [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[13.5px] [&_th]:font-medium [&_th]:text-white",
            "[&_td]:border [&_td]:border-separator [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-[14.5px]",
            "[&_strong]:font-semibold",
          ].join(" ")}
        />
      </div>

      <p className="border-t border-separator bg-paper-alt px-4 py-1.5 text-right text-[12px] text-slate-light">
        {mots > 0 ? `${mots} mot${mots > 1 ? "s" : ""}` : " "}
      </p>
    </div>
  );
}
