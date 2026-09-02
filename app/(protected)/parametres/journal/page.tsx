import { getJournalAudit } from "@/app/actions/audit";
import Breadcrumb from "@/components/Breadcrumb";
import JournalAudit from "./JournalAudit";

export const metadata = { title: "Journal d'audit" };

export default async function JournalPage() {
  const entrees = await getJournalAudit(7);

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Paramètres", href: "/parametres" },
          { label: "Journal d'audit" },
        ]}
      />
      <JournalAudit entrees={entrees} />
    </div>
  );
}
