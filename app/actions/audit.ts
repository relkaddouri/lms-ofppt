"use server";

import { createClient } from "@/lib/supabase/server";

/** Familles d'entrées, telles que la maquette les étiquette. */
export type PorteeAudit = "Contrôle" | "Note" | "Fiche";

export type ChangementAudit = {
  champ: string;
  avant: string;
  apres: string;
};

export type EntreeAudit = {
  id: string;
  action: string;
  portee: PorteeAudit;
  auteur: string;
  cible: string;
  date: string;
  reference: string;
  changements: ChangementAudit[];
};

/**
 * Champs suivis par famille, avec leur libellé lisible.
 *
 * Le journal ne déverse pas la ligne entière : une entrée utile nomme ce qui a
 * changé, pas les quarante colonnes qui n'ont pas bougé. Les champs techniques
 * — identifiants, horodatages internes — n'y figurent donc pas.
 */
const CHAMPS: Record<string, Record<string, string>> = {
  controles: {
    titre: "Titre",
    statut: "Statut",
    type: "Nature",
    type_efm: "Portée de l'EFM",
    format: "Format",
    date_prevue: "Date de session",
    duree_heures: "Durée",
    consignes: "Consignes",
  },
  passations_controle: {
    note: "Note finale",
  },
  fiches_preparation: {
    version: "Version",
    contenu: "Contenu de la fiche",
  },
};

const PORTEES: Record<string, PorteeAudit> = {
  controles: "Contrôle",
  passations_controle: "Note",
  fiches_preparation: "Fiche",
};

const ACTIONS: Record<string, Record<string, string>> = {
  controles: {
    INSERT: "Contrôle validé",
    UPDATE: "Contrôle modifié",
    DELETE: "Contrôle supprimé",
  },
  passations_controle: { UPDATE: "Copie corrigée" },
  fiches_preparation: {
    INSERT: "Fiche de préparation enregistrée",
    UPDATE: "Fiche de préparation modifiée",
    DELETE: "Fiche de préparation supprimée",
  },
};

function lisible(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (typeof valeur === "boolean") return valeur ? "oui" : "non";
  const texte = String(valeur);
  return texte.length > 160 ? `${texte.slice(0, 158)}…` : texte;
}

function comparer(
  table: string,
  avant: Record<string, unknown> | null,
  apres: Record<string, unknown> | null,
): ChangementAudit[] {
  const champs = CHAMPS[table] ?? {};
  const changements: ChangementAudit[] = [];

  for (const [cle, libelle] of Object.entries(champs)) {
    const a = avant?.[cle];
    const b = apres?.[cle];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    changements.push({ champ: libelle, avant: lisible(a), apres: lisible(b) });
  }

  return changements;
}

/**
 * Journal d'audit du formateur, sur une fenêtre glissante.
 *
 * La RLS borne déjà les lignes à ce qu'il peut atteindre ; la requête ne
 * refiltre donc pas, elle se contente de la fenêtre et de l'ordre.
 */
export async function getJournalAudit(jours = 7): Promise<EntreeAudit[]> {
  const supabase = await createClient();

  const depuis = new Date();
  depuis.setDate(depuis.getDate() - jours);

  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, table_name, ligne_id, action, ancienne_valeur, nouvelle_valeur, utilisateur, date",
    )
    .gte("date", depuis.toISOString())
    .order("date", { ascending: false })
    .limit(120);

  if (error) throw new Error(error.message);

  const lignes = data ?? [];

  // `profils` ne porte pas de nom : la seule distinction honnête est
  // « moi » / « un autre formateur ». Nommer les co-formateurs demanderait
  // une colonne que le modèle n'a pas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return lignes.map((l) => {
    const avant = l.ancienne_valeur as Record<string, unknown> | null;
    const apres = l.nouvelle_valeur as Record<string, unknown> | null;
    const source = apres ?? avant ?? {};

    return {
      id: l.id,
      action:
        ACTIONS[l.table_name]?.[l.action] ??
        `${l.table_name} · ${l.action.toLowerCase()}`,
      portee: PORTEES[l.table_name] ?? "Contrôle",
      auteur: !l.utilisateur
        ? "Système"
        : l.utilisateur === user?.id
          ? "Vous"
          : "Un autre formateur",
      cible: String(
        source.titre ?? source.nom_complet ?? l.ligne_id?.slice(0, 8) ?? "—",
      ),
      date: l.date,
      // Une référence stable et courte, celle qu'on recopie sur un rapport.
      reference: `AUD-${String(l.id).slice(0, 8).toUpperCase()}`,
      changements: comparer(l.table_name, avant, apres),
    };
  });
}
