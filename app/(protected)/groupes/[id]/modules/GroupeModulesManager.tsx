"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setMasseHoraire, type GroupeModuleInfo } from "@/app/actions/groupes";
import Card from "@/components/ui/Card";
import Button, { buttonStyles } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ArrowRight, BookOpen, Check, Clock, Pencil, X } from "lucide-react";

export default function GroupeModulesManager({
  groupeId,
  modules,
}: {
  groupeId: string;
  modules: GroupeModuleInfo[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [valeur, setValeur] = useState("");
  const [busy, setBusy] = useState(false);

  const total = modules.reduce((s, m) => s + m.masse_horaire_allouee, 0);

  function ouvrirEdition(m: GroupeModuleInfo) {
    setEnEdition(m.module_id);
    setValeur(String(m.masse_horaire_allouee));
  }

  const nombre = Number(valeur);
  const erreur =
    valeur.trim() === ""
      ? "Saisissez un nombre d'heures."
      : !Number.isFinite(nombre) || nombre < 0
        ? "La masse horaire doit être un nombre positif."
        : null;

  async function enregistrer(moduleId: string) {
    if (erreur) return;
    setBusy(true);
    try {
      await setMasseHoraire(groupeId, moduleId, nombre);
      setEnEdition(null);
      toast("Masse horaire enregistrée");
      router.refresh();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Erreur inattendue",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (modules.length === 0) {
    return (
      <Card className="mt-6 p-10 text-center" padded={false}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wash">
          <BookOpen className="h-6 w-6 text-ink" aria-hidden />
        </div>
        <p className="mt-4 text-sm font-medium text-ink">
          Aucun module assigné à ce groupe
        </p>
        <p className="mt-1 text-sm text-slate">
          Assignez des modules au groupe pour pouvoir répartir leur masse
          horaire.
        </p>
        <Link href="/groupes" className={buttonStyles("primary", "md", "mt-5")}>
          <BookOpen size={16} aria-hidden />
          Gérer les groupes
        </Link>
      </Card>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">
          Modules du groupe
        </h2>
        <p className="text-sm text-slate">
          Masse horaire totale allouée :{" "}
          <span className="font-mono font-medium text-ink">{total} h</span>
        </p>
      </div>

      <p className="mt-1 max-w-[640px] text-sm text-slate">
        La masse horaire est propre à ce groupe : un même module peut valoir un
        volume différent pour un autre groupe. La durée de référence nationale
        n&apos;est qu&apos;un repère.
      </p>

      <div className="mt-4 space-y-3">
        {modules.map((m) => {
          const edition = enEdition === m.module_id;
          const ecart = m.masse_horaire_allouee - m.duree_reference;

          return (
            <Card key={m.module_id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    {m.code_operationnel ? (
                      <span className="font-mono text-sm font-medium text-ink">
                        {m.code_operationnel}
                      </span>
                    ) : null}
                    <span className="truncate text-sm font-semibold text-ink">
                      {m.nom}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate">
                    Référence nationale :{" "}
                    <span className="font-mono">{m.duree_reference} h</span>
                    {ecart !== 0 ? (
                      <>
                        {" · "}
                        <span className="font-mono">
                          {ecart > 0 ? "+" : ""}
                          {ecart} h
                        </span>{" "}
                        pour ce groupe
                      </>
                    ) : null}
                  </p>
                  <Link
                    href={`/groupes/${groupeId}/modules/${m.module_id}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink underline"
                  >
                    Plan de déroulement
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {edition ? (
                  <div className="flex w-full max-w-[320px] items-start gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        autoFocus
                        value={valeur}
                        onChange={(e) => setValeur(e.target.value)}
                        error={erreur}
                        label={
                          <span className="text-xs text-slate">
                            Masse horaire (heures)
                          </span>
                        }
                      />
                    </div>
                    <div className="mt-6 flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        icon={Check}
                        onClick={() => enregistrer(m.module_id)}
                        disabled={busy || erreur !== null}
                      >
                        Enregistrer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={X}
                        onClick={() => setEnEdition(null)}
                        disabled={busy}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-wash px-3 py-1 font-mono text-sm font-medium text-ink">
                      <Clock size={16} aria-hidden />
                      {m.masse_horaire_allouee} h
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      onClick={() => ouvrirEdition(m)}
                    >
                      Modifier
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
