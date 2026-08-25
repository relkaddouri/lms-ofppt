"use client";

/**
 * Page de démonstration des composants partagés (atome 0.3).
 * Route publique volontairement hors de `(protected)` : elle n'affiche aucune
 * donnée. Supprimable une fois la migration des écrans terminée.
 */

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input, { Textarea } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateTime, initials, slugify } from "@/lib/format";
import { Plus, Save, Trash2 } from "lucide-react";

const TONES: BadgeTone[] = ["success", "info", "danger", "neutral"];
const LIBELLES: Record<BadgeTone, string> = {
  success: "Validé",
  info: "Brouillon",
  danger: "Échec",
  neutral: "Archivé",
};

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-ink">{titre}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DemoUiPage() {
  const toast = useToast();
  const [modalOuverte, setModalOuverte] = useState(false);
  const [confirmOuverte, setConfirmOuverte] = useState(false);
  const [email, setEmail] = useState("sara.el-amrani");

  const emailInvalide =
    email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-8 py-8">
      <h1 className="font-display text-[28px] font-bold text-ink">
        Composants partagés
      </h1>
      <p className="mt-1 text-sm text-slate">
        Démonstration des composants de <code>components/ui/</code> et des
        utilitaires de <code>lib/format.ts</code>.
      </p>

      <Section titre="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Plus}>Créer un groupe</Button>
          <Button variant="secondary" icon={Save} size="sm">Enregistrer</Button>
          <Button variant="ghost" size="sm">Exporter</Button>
          <Button variant="danger" icon={Trash2} size="sm">Supprimer</Button>
          <Button variant="primary" size="touch">Cible tactile 44px</Button>
          <Button variant="primary" disabled>Désactivé</Button>
          <Button variant="primary" loading loadingLabel="Création…">Créer</Button>
        </div>
      </Section>

      <Section titre="Champs de formulaire">
        <div className="max-w-[640px] space-y-4">
          <Input label="Nom" placeholder="El Amrani" defaultValue="El Amrani" />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailInvalide ? "Format d'email invalide." : null}
            hint="Validation en ligne, dès la frappe."
          />
          <Textarea label="Consignes" rows={3} placeholder="Consignes du contrôle…" />
        </div>
      </Section>

      <Section titre="Cartes">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <p className="font-display text-[28px] font-bold leading-none text-ink">24</p>
            <p className="mt-2 text-sm text-slate">Stagiaires</p>
          </Card>
          <Card>
            <p className="font-display text-[28px] font-bold leading-none text-ink">3</p>
            <p className="mt-2 text-sm text-slate">Groupes actifs</p>
          </Card>
          <Card highlight>
            <p className="font-display text-[28px] font-bold leading-none text-ink">2</p>
            <p className="mt-2 text-sm text-slate">Contrôles à valider</p>
          </Card>
        </div>
      </Section>

      <Section titre="Badges">
        <p className="text-xs uppercase tracking-wider text-slate">Statut (fond pastel)</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {TONES.map((t) => (
            <Badge key={t} tone={t} variant="statut">{LIBELLES[t]}</Badge>
          ))}
        </div>
        <p className="mt-5 text-xs uppercase tracking-wider text-slate">Type (bordure fine)</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {TONES.map((t) => (
            <Badge key={t} tone={t} variant="type">{LIBELLES[t]}</Badge>
          ))}
        </div>
      </Section>

      <Section titre="Modale, confirmation et toast">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setModalOuverte(true)}>
            Ouvrir la modale
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmOuverte(true)}>
            Supprimer un stagiaire
          </Button>
          <Button variant="ghost" onClick={() => toast("Modification enregistrée")}>
            Toast succès
          </Button>
          <Button variant="ghost" onClick={() => toast("Échec de l'enregistrement", "error")}>
            Toast erreur
          </Button>
        </div>
      </Section>

      <Section titre="lib/format.ts">
        <Card>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate">formatDate(&quot;2026-03-09&quot;)</dt><dd className="font-mono text-ink">{formatDate("2026-03-09")}</dd></div>
            <div><dt className="text-slate">formatDate(null)</dt><dd className="font-mono text-ink">{formatDate(null)}</dd></div>
            <div><dt className="text-slate">formatDateTime(iso)</dt><dd className="font-mono text-ink">{formatDateTime("2026-03-09T14:05:00Z")}</dd></div>
            <div><dt className="text-slate">initials(&quot;Sara&quot;, &quot;El Amrani&quot;)</dt><dd className="font-mono text-ink">{initials("Sara", "El Amrani")}</dd></div>
            <div><dt className="text-slate">initials(email)</dt><dd className="font-mono text-ink">{initials("s.el-amrani@ofppt.ma")}</dd></div>
            <div><dt className="text-slate">slugify(&quot;Contrôle — M106&quot;)</dt><dd className="font-mono text-ink">{slugify("Contrôle — M106")}</dd></div>
          </dl>
        </Card>
      </Section>

      <Modal
        open={modalOuverte}
        onClose={() => setModalOuverte(false)}
        title="Créer un groupe"
        description="Ferme sur Échap, sur la croix, ou par clic hors du panneau."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOuverte(false)}>Annuler</Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setModalOuverte(false);
                toast("Groupe créé");
              }}
            >
              Créer
            </Button>
          </>
        }
      >
        <Input label="Nom du groupe" placeholder="DES101" />
      </Modal>

      <ConfirmModal
        open={confirmOuverte}
        onClose={() => setConfirmOuverte(false)}
        onConfirm={() => {
          setConfirmOuverte(false);
          toast("Stagiaire supprimé");
        }}
        title="Supprimer ce stagiaire ?"
        message="Supprimer définitivement Sara El Amrani ? Cette action est irréversible."
      />
    </main>
  );
}
