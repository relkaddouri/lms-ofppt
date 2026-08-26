import { createPublicClient } from "@/lib/supabase/public";
import RailDeProgression from "@/components/RailDeProgression";

type GroupePublic = {
  id: string;
  nom: string;
  date_debut: string | null;
  date_fin: string | null;
  token_public: string;
};

type ProgressionPublique = {
  module_id: string;
  module_nom: string | null;
  code_operationnel: string | null;
  masse_horaire_allouee: number | string;
  heures_realisees: number | string;
  nb_seances: number | string;
  nb_seances_faites: number | string;
};

type AnnoncePublic = {
  id: string;
  groupe_id: string;
  titre: string;
  contenu: string | null;
  date: string | null;
};

export const dynamic = "force-dynamic";

export default async function PublicGroupePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = createPublicClient();

  const { data: groupeRaw } = await supabase
    .rpc("get_groupe_by_token", { p_token: token })
    .single();

  const groupe = (groupeRaw ?? null) as GroupePublic | null;

  if (!groupe) {    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            Lien invalide
          </h1>
          <p className="mt-2 text-sm text-slate">
            Ce lien de partage n&apos;existe pas ou n&apos;est plus actif.
          </p>
        </div>
      </main>
    );
  }

  const [annoncesRes, progressionRes] = await Promise.all([
    supabase.rpc("get_annonces_by_token", { p_token: token }),
    supabase.rpc("get_progression_by_groupe_token", { p_token: token }),
  ]);

  const annonces = (annoncesRes.data ?? []) as AnnoncePublic[];
  const progression = ((progressionRes.data ?? []) as ProgressionPublique[]).map(
    (p) => ({
      ...p,
      masse_horaire_allouee: Number(p.masse_horaire_allouee) || 0,
      heures_realisees: Number(p.heures_realisees) || 0,
    }),
  );

  return (
    <main className="min-h-screen bg-paper">
      <header className="flex items-center justify-between bg-ink px-6 py-4">
        <div className="font-display text-lg font-bold text-white">
          LMS OFPPT
        </div>
        <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-white">
          Espace stagiaire
        </span>
      </header>

      <div className="mx-auto w-full max-w-[1200px] px-8 py-8">
        <h1 className="font-display text-[28px] font-bold text-ink">
          {groupe.nom}
        </h1>
        <p className="mt-1 font-mono text-sm text-slate">
          {groupe.date_debut ? new Date(groupe.date_debut).toLocaleDateString("fr-FR") : "—"}
          {" → "}
          {groupe.date_fin ? new Date(groupe.date_fin).toLocaleDateString("fr-FR") : "—"}
        </p>

        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-ink">Annonces</h2>
          {annonces.length === 0 ? (
            <p className="mt-3 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 text-sm text-slate">
              Aucune annonce pour le moment.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {annonces.map((a) => (
                <article
                  key={a.id}
                  className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-lg font-bold text-ink">
                      {a.titre}
                    </h3>
                    {a.date ? (
                      <span className="shrink-0 font-mono text-xs text-slate">
                        {new Date(a.date).toLocaleDateString("fr-FR")}
                      </span>
                    ) : null}
                  </div>
                  {a.contenu ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-ink">
                      {a.contenu}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-ink">
            Progression
          </h2>
          {progression.length === 0 ? (
            <p className="mt-3 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 text-sm text-slate">
              Aucun module suivi pour le moment.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {progression.map((p) => (
                <div
                  key={p.module_id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      {p.code_operationnel ? (
                        <span className="font-mono text-sm font-medium text-forest">
                          {p.code_operationnel}
                        </span>
                      ) : null}
                      <h3 className="font-display text-lg font-bold text-ink">
                        {p.module_nom ?? "Module"}
                      </h3>
                    </div>
                  </div>
                  <RailDeProgression
                    heuresRealisees={p.heures_realisees}
                    masseHoraire={p.masse_horaire_allouee}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t border-border pt-4 text-center text-xs text-slate">
          LMS OFPPT — Page publique du groupe
        </footer>
      </div>
    </main>
  );
}
