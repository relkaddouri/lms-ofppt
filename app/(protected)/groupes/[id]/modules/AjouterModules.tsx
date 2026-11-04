"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ajouterModulesAuGroupe,
  type ModuleAAjouter,
} from "@/app/actions/groupes";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { libelleModule } from "@/lib/modules";
import { Plus, X } from "lucide-react";

/**
 * Ajouter un module à un groupe déjà créé.
 *
 * Jusqu'ici les modules d'un groupe ne se choisissaient qu'à sa création :
 * un module oublié, ou ajouté au référentiel en cours d'année, ne pouvait
 * plus le rejoindre. Les modules déjà suivis n'apparaissent pas — leurs
 * heures et leur type d'EFM ne sont jamais touchés par un ajout.
 */
export default function AjouterModules({
  groupeId,
  candidats,
  variante = "secondary",
}: {
  groupeId: string;
  candidats: ModuleAAjouter[];
  variante?: "primary" | "secondary";
}) {
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function basculer(id: string) {
    setChoisis((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function fermer() {
    setOuvert(false);
    setChoisis([]);
  }

  async function ajouter() {
    if (choisis.length === 0) return;
    setBusy(true);
    try {
      // La réponse de l'action porte déjà la page à jour : pas de
      // router.refresh(), qui en referait un second rendu (audit CPU, §10.7).
      const nombre = await ajouterModulesAuGroupe(groupeId, choisis);
      toast(
        nombre === 0
          ? "Ces modules étaient déjà dans le groupe."
          : `${nombre} module${nombre > 1 ? "s" : ""} ajouté${nombre > 1 ? "s" : ""} — répartissez maintenant ${nombre > 1 ? "leurs" : "ses"} heures.`,
      );
      fermer();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ajout impossible", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variante} icon={Plus} onClick={() => setOuvert(true)}>
        Ajouter un module
      </Button>

      <Modal
        open={ouvert}
        onClose={fermer}
        title="Ajouter un module au groupe"
        description="Chaque module ajouté démarre sur sa durée de référence, en présentiel du premier semestre. Vous la répartissez ensuite."
      >
        {candidats.length === 0 ? (
          <p className="text-sm text-slate">
            Ce groupe suit déjà tous les modules de son année. Un module qui
            manque se crée d&apos;abord dans{" "}
            <Link href="/modules" className="font-medium text-ink underline">
              Modules
            </Link>
            .
          </p>
        ) : (
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {candidats.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-encre/50"
              >
                <input
                  type="checkbox"
                  checked={choisis.includes(m.id)}
                  onChange={() => basculer(m.id)}
                  className="h-4 w-4 accent-ink"
                />
                <span className="text-ink">{libelleModule(m.code, m.nom)}</span>
                <span className="ml-auto font-mono text-xs text-slate">
                  {m.duree_reference}h
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" icon={X} onClick={fermer}>
            Annuler
          </Button>
          <Button
            icon={Plus}
            onClick={ajouter}
            disabled={choisis.length === 0}
            loading={busy}
            loadingLabel="Ajout…"
          >
            {choisis.length > 1
              ? `Ajouter ${choisis.length} modules`
              : "Ajouter"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
