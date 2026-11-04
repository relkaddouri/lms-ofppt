import type { createClient } from "@/lib/supabase/server";
import { construirePlan } from "@/lib/planification";
import { compterControles } from "@/lib/progression";
import { instantEtablissement } from "@/lib/format";

/**
 * Les séances d'un module, créées à partir de sa répartition horaire.
 *
 * Partagé par la génération du plan (répartition) et par le recalcul de
 * l'emploi du temps, qui reconstruit un module encore entièrement à venir
 * quand ses heures ne tombent plus juste (PRD §4.9). Hors d'un fichier
 * « use server » : ces fonctions reçoivent un client, elles ne sont pas des
 * actions qu'un navigateur pourrait appeler.
 */

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Répartit les éléments de contenu du référentiel sur les séances générées.
 *
 * PRD §4.2bis : l'EFF national porte sur ce référentiel, donc chaque élément
 * doit avoir été traité. Une séance ne reçoit pas l'apprentissage entier mais
 * une part précise et non chevauchante de sa liste — l'ensemble des séances
 * d'un apprentissage couvre 100 %% de ses éléments, sans doublon ni oubli.
 *
 * Les parts sont contiguës et suivent l'ordre du référentiel : les six
 * éléments de A.1 sur deux séances donnent 1-3 puis 4-6, pas un panachage.
 * Un apprentissage qui a moins d'éléments que de séances en laisse certaines
 * sans élément propre — c'est le référentiel qui est ainsi, pas un oubli.
 */
export async function repartirElementsContenu(
  supabase: Client,
  seances: { id: string; suggestion_pedagogique_id: string | null }[],
): Promise<number> {
  const parApprentissage = new Map<string, string[]>();
  for (const s of seances) {
    if (!s.suggestion_pedagogique_id) continue;
    const liste = parApprentissage.get(s.suggestion_pedagogique_id) ?? [];
    liste.push(s.id);
    parApprentissage.set(s.suggestion_pedagogique_id, liste);
  }
  if (parApprentissage.size === 0) return 0;

  const { data: elements, error } = await supabase
    .from("elements_contenu")
    .select("id, suggestion_pedagogique_id, ordre")
    .in("suggestion_pedagogique_id", [...parApprentissage.keys()])
    .order("ordre");
  if (error) throw new Error(error.message);

  const liens: { seance_id: string; element_contenu_id: string }[] = [];
  for (const [suggestionId, seanceIds] of parApprentissage) {
    const propres = (elements ?? []).filter(
      (e) => e.suggestion_pedagogique_id === suggestionId,
    );
    if (propres.length === 0) continue;

    // Parts contiguës : les premières séances prennent le reste de la
    // division, pour que l'écart entre elles ne dépasse jamais un élément.
    const base = Math.floor(propres.length / seanceIds.length);
    const reste = propres.length % seanceIds.length;
    let curseur = 0;
    for (let i = 0; i < seanceIds.length; i += 1) {
      const combien = base + (i < reste ? 1 : 0);
      for (const e of propres.slice(curseur, curseur + combien)) {
        liens.push({ seance_id: seanceIds[i]!, element_contenu_id: e.id });
      }
      curseur += combien;
    }
  }

  if (liens.length === 0) return 0;
  const { error: errLiens } = await supabase
    .from("seance_elements_contenu")
    .insert(liens);
  if (errLiens) throw new Error(errLiens.message);
  return liens.length;
}


/**
 * Crée les séances non datées d'un module d'après ses lignes de répartition,
 * les rattache au groupe et leur répartit les éléments de contenu.
 *
 * Aucune évaluation n'est créée ici : les contrôles d'un module ne se
 * régénèrent pas à chaque reconstruction de ses séances.
 *
 * `lot` : l'horodatage à donner aux lignes. Le recalcul range les modules
 * d'un groupe par ancienneté de leurs séances ; une reconstruction datée
 * d'aujourd'hui enverrait le module en fin de file.
 */
export async function creerSeancesDuPlan(
  supabase: Client,
  groupeId: string,
  moduleId: string,
  lignes: {
    id: string;
    code: string;
    intitule: string;
    heures_theoriques: number;
    heures_pratiques: number;
  }[],
  lot?: string,
): Promise<number> {
  const { seances } = construirePlan(lignes);
  if (seances.length === 0) return 0;

  const { data: creees, error } = await supabase
    .from("seances")
    .insert(
      seances.map((s) => ({
        module_id: moduleId,
        suggestion_pedagogique_id: s.suggestion_pedagogique_id,
        nature: s.nature,
        duree_prevue: s.duree,
        statut: "a_faire",
        objectif_operationnel: `${s.code} — ${s.objectif}`,
        ...(lot ? { created_at: lot } : {}),
      })),
    )
    .select("id, suggestion_pedagogique_id");
  if (error) throw new Error(error.message);

  const { error: errLiens } = await supabase.from("seance_groupes").insert(
    (creees ?? []).map((s) => ({ seance_id: s.id, groupe_id: groupeId })),
  );
  if (errLiens) throw new Error(errLiens.message);

  await repartirElementsContenu(supabase, creees ?? []);
  return seances.length;
}

/**
 * Par séance du groupe, les heures que le contrôle d'un autre module lui a
 * prises : la séance M203 du 14/10, marquée faite, a servi à l'EFM de M202.
 *
 * Ces heures ne sont pas des heures de M203 : elles manquent à M203 et
 * doivent être refaites. La génération des séances manquantes et le
 * recalcul les retirent donc des heures de la séance, avec la même règle que
 * la progression (`compterControles`).
 */
export async function heuresCedeesDuGroupe(
  supabase: Client,
  groupeId: string,
): Promise<Map<string, number>> {
  const aujourdhui = instantEtablissement().date;
  const { data: controles, error } = await supabase
    .from("controles")
    .select("id, module_id, type, statut, date_prevue, duree_heures")
    .eq("groupe_id", groupeId)
    .in("type", ["CC", "EFM"])
    .eq("statut", "valide")
    .lte("date_prevue", aujourdhui)
    .limit(200);
  if (error) throw new Error(error.message);

  const jours = [
    ...new Set((controles ?? []).map((c) => c.date_prevue).filter(Boolean)),
  ] as string[];
  if (jours.length === 0) return new Map();

  // Les séances de ces jours-là seulement, dans l'ordre où la progression
  // cherche la séance qui a cédé son créneau.
  const { data: seances, error: errS } = await supabase
    .from("seances")
    .select(
      "id, module_id, date, statut, duree_prevue, duree_realisee, seance_groupes!inner(groupe_id)",
    )
    .eq("seance_groupes.groupe_id", groupeId)
    .in("date", jours)
    .order("date")
    .order("heure_debut", { nullsFirst: false })
    .order("created_at")
    .limit(500);
  if (errS) throw new Error(errS.message);

  return compterControles(
    (seances ?? []) as unknown as Parameters<typeof compterControles>[0],
    (controles ?? []) as unknown as Parameters<typeof compterControles>[1],
    aujourdhui,
  ).cedees;
}
