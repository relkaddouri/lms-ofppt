"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import NouvelleSeanceForm from "./NouvelleSeanceForm";
import type { GroupeModuleInfo } from "@/app/actions/groupes";
import { CalendarPlus } from "lucide-react";

export default function PlanifierSeance({
  groupeId,
  modules,
}: {
  groupeId: string;
  modules: GroupeModuleInfo[];
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={CalendarPlus}
        onClick={() => setOuvert(true)}
      >
        Planifier une séance
      </Button>

      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Planifier une séance"
        description="Pour une séance isolée. Le plan de déroulement d'un module les crée en lot."
      >
        <NouvelleSeanceForm
          groupeId={groupeId}
          modules={modules}
          onCree={() => setOuvert(false)}
        />
      </Modal>
    </>
  );
}
