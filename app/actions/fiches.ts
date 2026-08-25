"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type FichePreparation = {
  id: string;
  module_id: string;
  contenu: string | null;
  version: number;
  statut: string;
  created_at: string;
};

export async function getFichesVersions(
  moduleId: string,
): Promise<FichePreparation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiches_preparation")
    .select("*")
    .eq("module_id", moduleId)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  return data as FichePreparation[];
}

export async function saveFiche(moduleId: string, contenu: string) {
  const supabase = await createClient();

  const { data: versions } = await supabase
    .from("fiches_preparation")
    .select("version")
    .eq("module_id", moduleId);

  const next =
    versions && versions.length
      ? Math.max(...versions.map((v) => v.version)) + 1
      : 1;

  const { error } = await supabase.from("fiches_preparation").insert({
    module_id: moduleId,
    contenu,
    version: next,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/modules/${moduleId}/fiche-preparation`);
  return next;
}
