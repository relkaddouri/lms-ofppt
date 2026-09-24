"use server";

import { createClient } from "@/lib/supabase/server";
import { libelleModule } from "@/lib/modules";

/**
 * Les cours du stagiaire, rangés par module (PRD §4.5bis).
 *
 * La liste chronologique des supports — « 13 supports, du plus récent au plus
 * ancien » — ne se suit pas : on révise une notion, pas une date. Les mêmes
 * supports se lisent donc comme un parcours : un module, ses parties — les
 * éléments de compétence du référentiel —, et sous chacune ses chapitres,
 * un par séance, dans l'ordre pédagogique.
 *
 * Rien de nouveau n'est écrit : la structure existe déjà dans le référentiel
 * (élément de compétence → apprentissage → séance). On la donne à voir.
 */

export type Chapitre = {
  /** L'identifiant du support : c'est lui qu'on ouvre. */
  id: string;
  seanceId: string;
  titre: string;
  type: "theorique" | "pratique";
  date: string | null;
  /** Rang dans le module, à partir de 1 — le numéro affiché du chapitre. */
  numero: number;
};

export type PartieCours = {
  lettre: string;
  intitule: string;
  chapitres: Chapitre[];
};

export type ModuleCours = {
  id: string;
  code: string | null;
  nom: string;
  libelle: string;
  /** Nombre de chapitres disponibles, c'est-à-dire de supports remis. */
  chapitres: number;
  /** Date du chapitre le plus récent, pour situer le module. */
  dernier: string | null;
};

export type SommaireModule = ModuleCours & { parties: PartieCours[] };

type LigneSupport = {
  id: string;
  seance_id: string;
  type: "theorique" | "pratique";
  contenu: unknown;
  version: number;
  seances: {
    date: string | null;
    module_id: string;
    modules: {
      nom: string;
      competences: { code_operationnel: string | null } | null;
    } | null;
    suggestions_pedagogiques: {
      ordre: number | null;
      apprentissage_base: string | null;
      elements_competence: {
        lettre: string | null;
        intitule: string | null;
        ordre: number | null;
      } | null;
    } | null;
  } | null;
};

/** Le titre écrit dans le support, à défaut le nom de son apprentissage. */
function titreDu(ligne: LigneSupport): string {
  const t = (ligne.contenu as { titre?: unknown } | null)?.titre;
  if (typeof t === "string" && t.trim()) return t.trim();
  const base = ligne.seances?.suggestions_pedagogiques?.apprentissage_base;
  return base?.trim() || "Chapitre";
}

/**
 * Tous les supports remis au groupe du stagiaire, une version par séance.
 *
 * La politique `supports_lecture_stagiaire` borne déjà la lecture à son
 * groupe et aux supports qui lui sont destinés.
 */
async function lireSupports(): Promise<LigneSupport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supports_seance")
    .select(
      "id, seance_id, type, contenu, version, seances(date, module_id, modules(nom, competences(code_operationnel)), suggestions_pedagogiques(ordre, apprentissage_base, elements_competence(lettre, intitule, ordre)))",
    )
    .eq("destinataire", "stagiaire")
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);

  // Une séance, un chapitre : la version la plus haute fait foi.
  const parSeance = new Map<string, LigneSupport>();
  for (const l of (data ?? []) as unknown as LigneSupport[]) {
    if (!parSeance.has(l.seance_id)) parSeance.set(l.seance_id, l);
  }
  return [...parSeance.values()];
}

/** L'ordre du parcours : la partie, puis l'apprentissage, puis la date. */
function comparer(a: LigneSupport, b: LigneSupport): number {
  const ea = a.seances?.suggestions_pedagogiques?.elements_competence;
  const eb = b.seances?.suggestions_pedagogiques?.elements_competence;
  return (
    (ea?.ordre ?? 99) - (eb?.ordre ?? 99) ||
    (ea?.lettre ?? "Z").localeCompare(eb?.lettre ?? "Z") ||
    (a.seances?.suggestions_pedagogiques?.ordre ?? 99) -
      (b.seances?.suggestions_pedagogiques?.ordre ?? 99) ||
    (a.seances?.date ?? "").localeCompare(b.seances?.date ?? "")
  );
}

/** Les modules dont le stagiaire a reçu au moins un chapitre. */
export async function getMesModulesCours(): Promise<ModuleCours[]> {
  const supports = await lireSupports();
  const modules = new Map<string, ModuleCours>();

  for (const l of supports) {
    const s = l.seances;
    if (!s?.module_id) continue;
    const vu = modules.get(s.module_id);
    const date = s.date ?? null;
    if (vu) {
      vu.chapitres += 1;
      if (date && (!vu.dernier || date > vu.dernier)) vu.dernier = date;
      continue;
    }
    const code = s.modules?.competences?.code_operationnel ?? null;
    const nom = s.modules?.nom ?? "Module";
    modules.set(s.module_id, {
      id: s.module_id,
      code,
      nom,
      libelle: libelleModule(code, nom),
      chapitres: 1,
      dernier: date,
    });
  }

  // Le module le plus récent d'abord : c'est celui qu'on suit en ce moment.
  return [...modules.values()].sort((a, b) =>
    (b.dernier ?? "").localeCompare(a.dernier ?? ""),
  );
}

/** Le sommaire d'un module : ses parties, et sous chacune ses chapitres. */
export async function getSommaireModule(
  moduleId: string,
): Promise<SommaireModule | null> {
  const supports = (await lireSupports()).filter(
    (l) => l.seances?.module_id === moduleId,
  );
  if (supports.length === 0) return null;

  supports.sort(comparer);

  const parties: PartieCours[] = [];
  let numero = 0;
  for (const l of supports) {
    const e = l.seances?.suggestions_pedagogiques?.elements_competence;
    const lettre = e?.lettre?.trim() || "—";
    const intitule = e?.intitule?.trim() || "Autres chapitres";
    let partie = parties.find((p) => p.lettre === lettre);
    if (!partie) {
      partie = { lettre, intitule, chapitres: [] };
      parties.push(partie);
    }
    numero += 1;
    partie.chapitres.push({
      id: l.id,
      seanceId: l.seance_id,
      titre: titreDu(l),
      type: l.type,
      date: l.seances?.date ?? null,
      numero,
    });
  }

  const premier = supports[0]!;
  const code = premier.seances?.modules?.competences?.code_operationnel ?? null;
  const nom = premier.seances?.modules?.nom ?? "Module";
  const dates = supports
    .map((l) => l.seances?.date)
    .filter((d): d is string => Boolean(d))
    .sort();

  return {
    id: moduleId,
    code,
    nom,
    libelle: libelleModule(code, nom),
    chapitres: supports.length,
    dernier: dates.at(-1) ?? null,
    parties,
  };
}
