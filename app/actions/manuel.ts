"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Données du manuel de formateur d'une compétence.
 *
 * Tout vient du référentiel déjà en base : le manuel officiel n'apporte rien
 * de plus. Seule la section 2.2 est calculée — c'est celle que l'OFPPT laisse
 * en « ? » et que la répartition horaire du formateur remplit.
 */

export type ElementManuel = {
  lettre: string;
  intitule: string;
  criteres: string[];
};

export type ObjectifManuel = {
  lettre: string;
  code: string;
  intitule: string;
  contenu: string | null;
  activites: string | null;
  pourcent: number | null;
  presentiel: boolean;
  synchrone: boolean;
  asynchrone: boolean;
  heuresTheoriques: number | null;
  heuresPratiques: number | null;
};

export type Manuel = {
  numero: number;
  nom: string;
  codeOfficiel: string | null;
  dureeNationale: number | null;
  pctTheorique: number;
  pctPratique: number;
  pctEvaluation: number;
  enonce: string | null;
  descriptionGenerale: string | null;
  contexteRealisation: string | null;
  criteresGeneraux: string | null;
  filiere: string;
  elements: ElementManuel[];
  objectifs: ObjectifManuel[];
  /** Groupe dont la répartition remplit la section 2.2, s'il y en a un. */
  groupeNom: string | null;
  masseHoraire: number | null;
};

export async function getManuel(
  moduleId: string,
  groupeId?: string,
): Promise<Manuel | null> {
  const supabase = await createClient();

  const { data: mod, error: errMod } = await supabase
    .from("modules")
    .select(
      "competence_id, competences(numero, nom, code_officiel, duree_nationale_heures, pct_theorique, pct_pratique, pct_evaluation, enonce_competence, description_generale, programmes(specialites(nom)))",
    )
    .eq("id", moduleId)
    .maybeSingle();

  if (errMod) throw new Error(errMod.message);
  const competenceId = (mod as { competence_id: string | null } | null)
    ?.competence_id;
  if (!competenceId) return null;

  const c = (mod as unknown as {
    competences: {
      numero: number;
      nom: string;
      code_officiel: string | null;
      duree_nationale_heures: number | null;
      pct_theorique: number | null;
      pct_pratique: number | null;
      pct_evaluation: number | null;
      enonce_competence: string | null;
      description_generale: string | null;
      programmes: { specialites: { nom: string } | null } | null;
    } | null;
  }).competences;
  if (!c) return null;

  const { data: fiche } = await supabase
    .from("fiches_prescrites")
    .select(
      "contexte_realisation, criteres_generaux_performance, elements_competence(lettre, intitule, ordre, criteres_particuliers_performance(texte, ordre), suggestions_pedagogiques(id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, presentiel, synchrone, asynchrone, ordre))",
    )
    .eq("competence_id", competenceId)
    .maybeSingle();

  type ElementBrut = {
    lettre: string;
    intitule: string;
    ordre: number;
    criteres_particuliers_performance: { texte: string; ordre: number }[] | null;
    suggestions_pedagogiques:
      | {
          id: string;
          code: string | null;
          apprentissage_base: string;
          elements_contenu: string | null;
          activites_apprentissage: string | null;
          duree_suggeree_pourcent: number | null;
          presentiel: boolean;
          synchrone: boolean;
          asynchrone: boolean;
          ordre: number;
        }[]
      | null;
  };

  const f = fiche as unknown as {
    contexte_realisation: string | null;
    criteres_generaux_performance: string | null;
    elements_competence: ElementBrut[] | null;
  } | null;

  const elementsTries = [...(f?.elements_competence ?? [])].sort(
    (a, b) => a.ordre - b.ordre,
  );

  // La répartition n'existe que pour un couple groupe + module : sans groupe,
  // le manuel sort avec ses « ? », comme le document officiel.
  let repartition = new Map<string, { t: number; p: number }>();
  let groupeNom: string | null = null;
  let masseHoraire: number | null = null;

  if (groupeId) {
    const [{ data: rep }, { data: couple }] = await Promise.all([
      supabase
        .from("repartition_horaire")
        .select("suggestion_pedagogique_id, heures_theoriques, heures_pratiques")
        .eq("groupe_id", groupeId)
        .eq("module_id", moduleId),
      supabase
        .from("groupe_modules")
        .select("masse_horaire_allouee, groupes(nom)")
        .eq("groupe_id", groupeId)
        .eq("module_id", moduleId)
        .maybeSingle(),
    ]);

    repartition = new Map(
      (rep ?? []).map((r) => [
        r.suggestion_pedagogique_id,
        { t: Number(r.heures_theoriques), p: Number(r.heures_pratiques) },
      ]),
    );
    const cp = couple as unknown as {
      masse_horaire_allouee: number;
      groupes: { nom: string } | null;
    } | null;
    groupeNom = cp?.groupes?.nom ?? null;
    masseHoraire = cp ? Number(cp.masse_horaire_allouee) : null;
  }

  const objectifs: ObjectifManuel[] = [];
  for (const el of elementsTries) {
    for (const s of [...(el.suggestions_pedagogiques ?? [])].sort(
      (a, b) => a.ordre - b.ordre,
    )) {
      const r = repartition.get(s.id);
      objectifs.push({
        lettre: el.lettre,
        code: s.code ?? "—",
        intitule: s.apprentissage_base,
        contenu: s.elements_contenu,
        activites: s.activites_apprentissage,
        pourcent: s.duree_suggeree_pourcent,
        presentiel: s.presentiel,
        synchrone: s.synchrone,
        asynchrone: s.asynchrone,
        heuresTheoriques: r?.t ?? null,
        heuresPratiques: r?.p ?? null,
      });
    }
  }

  return {
    numero: c.numero,
    nom: c.nom,
    codeOfficiel: c.code_officiel,
    dureeNationale: c.duree_nationale_heures,
    pctTheorique: Number(c.pct_theorique ?? 60),
    pctPratique: Number(c.pct_pratique ?? 34),
    pctEvaluation: Number(c.pct_evaluation ?? 6),
    enonce: c.enonce_competence,
    descriptionGenerale: c.description_generale,
    contexteRealisation: f?.contexte_realisation ?? null,
    criteresGeneraux: f?.criteres_generaux_performance ?? null,
    filiere: c.programmes?.specialites?.nom ?? "Digital Design",
    elements: elementsTries.map((el) => ({
      lettre: el.lettre,
      intitule: el.intitule,
      criteres: [...(el.criteres_particuliers_performance ?? [])]
        .sort((a, b) => a.ordre - b.ordre)
        .map((cr) => cr.texte),
    })),
    objectifs,
    groupeNom,
    masseHoraire,
  };
}
