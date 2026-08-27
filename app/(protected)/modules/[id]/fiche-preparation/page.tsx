import { getModules } from "@/app/actions/modules";
import {
  getFichesVersions,
  getSeancesAPreparer,
  getFicheLegacy,
} from "@/app/actions/fiches";
import { redirect } from "next/navigation";
import FichePreparationManager from "./FichePreparationManager";

export default async function FichePreparationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seance?: string; groupe?: string }>;
}) {
  const { id } = await params;
  const { seance: seanceParam, groupe } = await searchParams;

  const modules = await getModules();
  const module = modules.find((m) => m.id === id);
  if (!module) redirect("/modules");

  const seances = await getSeancesAPreparer(id, groupe);

  // Une fiche prépare une séance : à défaut de choix explicite, on ouvre la
  // première séance encore à faire, celle que le formateur prépare en pratique.
  const choisie =
    seances.find((s) => s.id === seanceParam) ??
    seances.find((s) => s.statut === "a_faire") ??
    seances[0];

  const [versions, ficheLegacy] = await Promise.all([
    choisie ? getFichesVersions(choisie.id) : Promise.resolve([]),
    getFicheLegacy(id),
  ]);

  return (
    <FichePreparationManager
      moduleId={id}
      moduleNom={module.nom}
      moduleDuree={module.duree_reference}
      seances={seances}
      seanceId={choisie?.id ?? null}
      versions={versions}
      ficheLegacy={ficheLegacy}
    />
  );
}
