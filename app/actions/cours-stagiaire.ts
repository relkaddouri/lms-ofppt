"use server";

import { createClient } from "@/lib/supabase/server";
import { libelleModule } from "@/lib/modules";
import { revalidatePath } from "next/cache";
import { jalonsDeBilan } from "@/lib/quiz";

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
  /** Le stagiaire l'a marqué comme lu (migration 097). */
  lu: boolean;
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
  /** Chapitres lus par le stagiaire, et le pourcentage qui en découle. */
  lus: number;
  progression: number;
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

/** Les chapitres que le stagiaire a marqués comme lus (migration 097). */
async function lireProgression(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("progression_chapitre")
    .select("support_id");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((l) => l.support_id));
}

/** Le pourcentage d'un module, arrondi à l'entier — jamais 99 % pour un module fini. */
const pourcentage = (lus: number, total: number) =>
  total > 0 ? Math.round((lus / total) * 100) : 0;

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
  const [supports, lus] = await Promise.all([lireSupports(), lireProgression()]);
  const modules = new Map<string, ModuleCours>();

  for (const l of supports) {
    const s = l.seances;
    if (!s?.module_id) continue;
    const vu = modules.get(s.module_id);
    const date = s.date ?? null;
    if (vu) {
      vu.chapitres += 1;
      if (lus.has(l.id)) vu.lus += 1;
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
      lus: lus.has(l.id) ? 1 : 0,
      progression: 0,
    });
  }

  // Le module le plus récent d'abord : c'est celui qu'on suit en ce moment.
  return [...modules.values()]
    .map((m) => ({ ...m, progression: pourcentage(m.lus, m.chapitres) }))
    .sort((a, b) => (b.dernier ?? "").localeCompare(a.dernier ?? ""));
}

/** Le sommaire d'un module : ses parties, et sous chacune ses chapitres. */
export async function getSommaireModule(
  moduleId: string,
): Promise<SommaireModule | null> {
  const [tous, lus] = await Promise.all([lireSupports(), lireProgression()]);
  const supports = tous.filter((l) => l.seances?.module_id === moduleId);
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
      lu: lus.has(l.id),
    });
  }

  const premier = supports[0]!;
  const code = premier.seances?.modules?.competences?.code_operationnel ?? null;
  const nom = premier.seances?.modules?.nom ?? "Module";
  const dates = supports
    .map((l) => l.seances?.date)
    .filter((d): d is string => Boolean(d))
    .sort();

  const nbLus = supports.filter((l) => lus.has(l.id)).length;

  return {
    id: moduleId,
    code,
    nom,
    libelle: libelleModule(code, nom),
    chapitres: supports.length,
    dernier: dates.at(-1) ?? null,
    lus: nbLus,
    progression: pourcentage(nbLus, supports.length),
    parties,
  };
}

/**
 * Le chapitre ouvert, avec son sommaire et ses voisins (PRD §4.5bis).
 *
 * Le sommaire accompagne la lecture plutôt que de l'attendre au retour : on
 * voit où l'on est dans le module, ce qui est lu, et le chapitre suivant se
 * prend sans repasser par la liste.
 */
export async function getChapitre(supportId: string): Promise<{
  module: SommaireModule;
  courant: Chapitre;
  precedent: Chapitre | null;
  suivant: Chapitre | null;
} | null> {
  const tous = await lireSupports();
  const ligne = tous.find((l) => l.id === supportId);
  const moduleId = ligne?.seances?.module_id;
  if (!moduleId) return null;

  const module = await getSommaireModule(moduleId);
  if (!module) return null;

  const suite = module.parties.flatMap((p) => p.chapitres);
  const i = suite.findIndex((c) => c.id === supportId);
  if (i < 0) return null;

  return {
    module,
    courant: suite[i]!,
    precedent: suite[i - 1] ?? null,
    suivant: suite[i + 1] ?? null,
  };
}

export type Jalon = {
  rang: number;
  moduleId: string;
  moduleNom: string;
  groupeId: string;
  chapitres: Chapitre[];
  /** Vrai quand les trois chapitres du jalon sont terminés. */
  pret: boolean;
};

/**
 * Les jalons d'un module : un bilan tous les trois chapitres (PRD §4.5bis).
 *
 * Le groupe est celui du stagiaire — deux groupes suivant le même module
 * n'ont pas les mêmes supports, donc pas le même bilan.
 */
export async function getJalons(moduleId: string): Promise<Jalon[]> {
  const module = await getSommaireModule(moduleId);
  if (!module) return [];

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data: moi } = user.user
    ? await supabase
        .from("stagiaires")
        .select("groupe_id")
        .eq("user_id", user.user.id)
        .maybeSingle()
    : { data: null };

  // Sans fiche stagiaire — le formateur qui regarde —, le groupe se lit sur
  // les séances du module elles-mêmes.
  let groupeId = moi?.groupe_id ?? null;
  if (!groupeId) {
    const { data: lien } = await supabase
      .from("seances")
      .select("seance_groupes(groupe_id)")
      .eq("module_id", moduleId)
      .limit(1)
      .maybeSingle();
    groupeId =
      (lien?.seance_groupes as { groupe_id: string }[] | undefined)?.[0]
        ?.groupe_id ?? null;
  }
  if (!groupeId) return [];

  const suite = module.parties.flatMap((p) => p.chapitres);
  return jalonsDeBilan(suite).map((j) => ({
    rang: j.rang,
    moduleId,
    moduleNom: module.nom,
    groupeId: groupeId!,
    chapitres: j.chapitres,
    pret: j.chapitres.every((c) => c.lu),
  }));
}

/** Un jalon précis, pour la page de bilan et pour sa génération. */
export async function getJalon(
  moduleId: string,
  rang: number,
): Promise<Jalon | null> {
  const jalons = await getJalons(moduleId);
  return jalons.find((j) => j.rang === rang) ?? null;
}

/**
 * Marque — ou démarque — un chapitre comme lu.
 *
 * La politique borne l'écriture aux lignes du stagiaire connecté ; on relit
 * donc sa fiche plutôt que de faire confiance à ce que le navigateur envoie.
 */
export async function marquerChapitreLu(
  supportId: string,
  lu: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Authentification requise.");

  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id")
    .eq("user_id", user.user.id)
    .maybeSingle();
  if (!moi) throw new Error("Aucune fiche stagiaire pour ce compte.");

  const { error } = lu
    ? await supabase
        .from("progression_chapitre")
        .upsert(
          { stagiaire_id: moi.id, support_id: supportId, lu_le: new Date().toISOString() },
          { onConflict: "stagiaire_id,support_id" },
        )
    : await supabase
        .from("progression_chapitre")
        .delete()
        .eq("stagiaire_id", moi.id)
        .eq("support_id", supportId);
  if (error) throw new Error(error.message);

  revalidatePath("/espace-stagiaire/cours", "layout");
}
