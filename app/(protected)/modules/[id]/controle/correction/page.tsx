import { getModules } from "@/app/actions/modules";
import { getGroupes } from "@/app/actions/groupes";
import { getControles, getPassations } from "@/app/actions/controles";
import { redirect } from "next/navigation";
import CorrectionManager from "./CorrectionManager";

export default async function CorrectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupe?: string; controle?: string; copie?: string }>;
}) {
  const [{ id }, recherche] = await Promise.all([params, searchParams]);

  const modules = await getModules();
  const module = modules.find((m) => m.id === id);
  if (!module) redirect("/modules");
  if (!recherche.groupe) redirect(`/modules/${id}`);

  // Le groupe nomme le document : un résultat signé dit de quelle classe et de
  // quelle filière il vient, pas seulement de quel module.
  const [controles, groupes] = await Promise.all([
    getControles(recherche.groupe, id),
    getGroupes(),
  ]);
  const groupe = groupes.find((g) => g.id === recherche.groupe) ?? null;

  // Le contrôle demandé, sinon le premier qui a des copies à corriger.
  const controleId = recherche.controle ?? controles[0]?.id ?? null;
  const copies = controleId ? await getPassations(controleId) : [];

  return (
    <CorrectionManager
      moduleId={id}
      moduleNom={module.nom}
      moduleCode={module.code}
      groupeId={recherche.groupe}
      groupeNom={groupe?.nom ?? null}
      filiere={groupe?.specialite ?? null}
      anneeGroupe={groupe?.annee ?? null}
      controles={controles}
      controleId={controleId}
      copies={copies}
      copieInitiale={recherche.copie ?? null}
    />
  );
}
