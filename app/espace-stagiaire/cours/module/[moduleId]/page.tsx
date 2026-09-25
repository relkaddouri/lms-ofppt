import { notFound } from "next/navigation";
import { getSommaireModule } from "@/app/actions/cours-stagiaire";
import SommaireVue from "./SommaireVue";

/**
 * Le sommaire d'un module (PRD §4.5bis).
 *
 * Deuxième niveau du parcours : les parties du référentiel — les éléments de
 * compétence — et, sous chacune, les chapitres dans l'ordre pédagogique. Le
 * stagiaire y retrouve la structure de son module, pas la chronologie de ses
 * séances : c'est ainsi qu'on révise.
 */
export default async function ModuleCoursPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const module = await getSommaireModule(moduleId);
  if (!module) notFound();

  return <SommaireVue module={module} />;
}
