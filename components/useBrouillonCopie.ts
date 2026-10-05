"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * La copie en cours, mise à l'abri pendant l'épreuve.
 *
 * Le stockage local du navigateur protégeait d'un rechargement, et de rien
 * d'autre : un ordinateur qui s'éteint, une navigation privée, un changement
 * de poste, et le travail disparaissait. Surtout, le formateur ne recevait
 * rien tant que la copie n'était pas rendue — un stagiaire déconnecté avant
 * la remise avait composé pour personne.
 *
 * Deux choix qui ne coûtent rien au serveur de l'application.
 *
 * L'écriture part du navigateur vers Supabase, directement, sous les policies
 * de la migration 112. Une épreuve de deux heures et demie pour seize
 * stagiaires représenterait sinon plus de mille exécutions Vercel pour de
 * simples écritures.
 *
 * Et la minuterie n'interroge rien : elle n'écrit que si le texte a changé
 * depuis le dernier envoi. Un stagiaire qui réfléchit dix minutes ne produit
 * aucune requête.
 */

export const INTERVALLE_BROUILLON_MS = 120_000;

export type EtatBrouillon = "repos" | "envoi" | "enregistre" | "hors_ligne";

export function useBrouillonCopie({
  controleId,
  stagiaireId,
  reponses,
  actif,
}: {
  controleId: string;
  stagiaireId: string | null;
  reponses: Record<string, string>;
  /** Faux en aperçu, et dès que la copie est rendue. */
  actif: boolean;
}): {
  etat: EtatBrouillon;
  /** Le brouillon retrouvé au serveur, s'il est plus récent que rien. */
  retrouve: Record<string, string> | null;
  oublier: () => void;
  effacer: () => Promise<void>;
} {
  const [etat, setEtat] = useState<EtatBrouillon>("repos");
  const [retrouve, setRetrouve] = useState<Record<string, string> | null>(null);

  const supabase = createClient();
  const reponsesRef = useRef(reponses);
  reponsesRef.current = reponses;
  // La dernière version envoyée, pour ne rien réécrire d'identique.
  const envoye = useRef<string | null>(null);

  const enregistrer = useCallback(async () => {
    if (!actif || !stagiaireId) return;
    const contenu = JSON.stringify(reponsesRef.current);
    if (contenu === envoye.current) return;
    // Une copie vide n'a pas à créer de ligne : elle ne dit rien de plus que
    // l'absence de ligne, et le formateur verrait un brouillon sans contenu.
    if (!Object.values(reponsesRef.current).some((v) => v.trim())) return;

    setEtat("envoi");
    try {
      const { error } = await supabase.from("brouillons_copie").upsert(
        {
          controle_id: controleId,
          stagiaire_id: stagiaireId,
          reponses: reponsesRef.current,
          maj_le: new Date().toISOString(),
        },
        { onConflict: "controle_id,stagiaire_id" },
      );
      if (error) throw new Error(error.message);
      envoye.current = contenu;
      setEtat("enregistre");
    } catch {
      // Hors ligne : c'est précisément le cas qu'on prépare. On le dit au
      // stagiaire sans l'alarmer, et on retentera au tour suivant — son
      // texte reste dans le navigateur entre-temps.
      setEtat("hors_ligne");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, controleId, stagiaireId]);

  // Ce qui a été laissé au serveur, relu une fois à l'ouverture.
  useEffect(() => {
    if (!actif || !stagiaireId) return;
    let vivant = true;
    void supabase
      .from("brouillons_copie")
      .select("reponses")
      .eq("controle_id", controleId)
      .eq("stagiaire_id", stagiaireId)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivant || !data?.reponses) return;
        const lu = data.reponses as Record<string, unknown>;
        const utiles = Object.fromEntries(
          Object.entries(lu).filter(([, v]) => typeof v === "string"),
        ) as Record<string, string>;
        if (Object.values(utiles).some((v) => v.trim())) {
          setRetrouve(utiles);
          envoye.current = JSON.stringify(utiles);
        }
      });
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, controleId, stagiaireId]);

  // Le rythme : toutes les deux minutes, et à chaque fois que la page passe
  // en arrière-plan. C'est là qu'on ferme un portable ou qu'on change
  // d'application — le moment exact où le travail se perdait.
  useEffect(() => {
    if (!actif || !stagiaireId) return;
    const minuterie = window.setInterval(() => void enregistrer(), INTERVALLE_BROUILLON_MS);
    const surMasquage = () => {
      if (document.visibilityState === "hidden") void enregistrer();
    };
    document.addEventListener("visibilitychange", surMasquage);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", surMasquage);
      // Un dernier envoi en quittant l'écran : la copie du moment part avec.
      void enregistrer();
    };
  }, [actif, stagiaireId, enregistrer]);

  const oublier = useCallback(() => setRetrouve(null), []);

  /** À la remise : le brouillon n'a plus d'objet, la copie existe. */
  const effacer = useCallback(async () => {
    if (!stagiaireId) return;
    try {
      await supabase
        .from("brouillons_copie")
        .delete()
        .eq("controle_id", controleId)
        .eq("stagiaire_id", stagiaireId);
    } catch {
      // Un brouillon qui survit à sa copie n'empêche rien : le formateur lit
      // la copie rendue. Inutile d'inquiéter un stagiaire qui vient de rendre.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controleId, stagiaireId]);

  return { etat, retrouve, oublier, effacer };
}
