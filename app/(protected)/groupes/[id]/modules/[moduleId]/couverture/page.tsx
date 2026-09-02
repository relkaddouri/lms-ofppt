import { getCouvertureModule } from "@/app/actions/couverture";
import { getGroupeModules } from "@/app/actions/groupes";
import Breadcrumb from "@/components/Breadcrumb";
import { libelleModule } from "@/lib/modules";
import CouvertureVue from "./CouvertureVue";

export const metadata = { title: "Couverture du référentiel" };

export default async function CouverturePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  const [couverture, modules] = await Promise.all([
    getCouvertureModule(id, moduleId),
    getGroupeModules(id),
  ]);
  const module = modules.find((m) => m.module_id === moduleId);

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Groupes", href: "/groupes" },
          { label: "Modules", href: `/groupes/${id}/modules` },
          {
            label: module
              ? libelleModule(module.code_operationnel, module.nom)
              : "Module",
            href: `/groupes/${id}/modules/${moduleId}`,
          },
          { label: "Couverture" },
        ]}
      />
      <CouvertureVue couverture={couverture} groupeId={id} />
    </div>
  );
}
