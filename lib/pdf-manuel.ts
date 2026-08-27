import type jsPDF from "jspdf";
import type { Manuel } from "@/app/actions/manuel";

/**
 * Manuel de formateur — « Guide de soutien pédagogique ».
 *
 * Reprend la structure du document officiel OFPPT : page de garde, sommaire,
 * fiches prescriptives et suggestions pédagogiques, puis stratégie pédagogique
 * et plan de déroulement.
 *
 * Une seule section n'est pas recopiée du référentiel : la 2.2, où le document
 * officiel laisse « ? H ». C'est là qu'atterrit la répartition du formateur.
 */

const X = 16;
const LARGEUR = 178;
const HAUT = 22;
const BAS = 275;

const ENCRE: [number, number, number] = [17, 24, 39];
const GRIS: [number, number, number] = [110, 116, 126];
const TRAIT: [number, number, number] = [150, 155, 162];
const FOND: [number, number, number] = [236, 239, 242];

/** Texte générique de la section 2.1, identique sur tous les modules. */
const STRATEGIE: { titre: string; intro?: string; puces: string[] }[] = [
  {
    titre: "2.1.1. Rôles et fonctions des formateurs",
    intro: "Les formateurs doivent adapter leur enseignement en tenant compte :",
    puces: [
      "d'une approche intégrée des objets de formation ;",
      "du rythme individuel et de la façon d'apprendre des apprenants ;",
      "d'une responsabilité accrue des apprenants au regard de leurs apprentissages.",
    ],
  },
  {
    titre: "2.1.2. Planification de l'enseignement",
    intro:
      "Situer les modules dont ils ont la responsabilité, puis à l'aide du logigramme de la séquence d'enseignement :",
    puces: [
      "ajouter ou ajuster, au besoin, les éléments du contenu ;",
      "prévoir et produire des activités propres à ces modules ;",
      "coordonner les activités d'apprentissage pour les apprenants ;",
      "répartir les postes de travail et le matériel nécessaire ;",
      "agencer et élaborer les activités d'apprentissage, d'évaluation, d'enseignement correctif et d'enrichissement.",
    ],
  },
  {
    titre: "2.1.3. Information à l'apprenant",
    intro: "Cette fonction consiste à :",
    puces: [
      "situer les apprenants par rapport à l'ensemble du programme et au module en cours ;",
      "fournir les données utiles à une compréhension suffisante des tâches reliées au métier ;",
      "faire ressortir l'importance et la pertinence des apprentissages à réaliser.",
    ],
  },
  {
    titre: "2.1.4. Animation pédagogique",
    intro: "Le formateur doit :",
    puces: [
      "guider les apprentissages par un rappel des objectifs et la détermination des préalables ;",
      "créer un climat de confiance reposant sur le respect des personnes et de leur autonomie ;",
      "maintenir l'intérêt par des activités diversifiées et un dosage judicieux de la difficulté ;",
      "encadrer les activités par un suivi souple et une assistance aux apprenants en difficulté ;",
      "fournir des explications claires et justes au groupe et à chaque apprenant.",
    ],
  },
  {
    titre: "2.1.5. Évaluation des compétences",
    intro: "Le formateur assure le suivi :",
    puces: [
      "en produisant et en utilisant des instruments d'évaluation formative ;",
      "en administrant les épreuves aux fins de diplomation ;",
      "en fournissant les résultats à la personne responsable dans le centre de formation.",
    ],
  },
];

function heures(v: number | null): string {
  if (v === null) return "?";
  const total = Math.round(v * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export async function construireManuelPdf(m: Manuel): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  let y = HAUT;

  const place = (h: number) => {
    if (y + h > BAS) {
      doc.addPage();
      y = HAUT;
    }
  };

  function titre(texte: string, taille = 13, espaceAvant = 8) {
    y += espaceAvant;
    place(12);
    doc.setFont("helvetica", "bold").setFontSize(taille).setTextColor(...ENCRE);
    doc.text(texte, X, y);
    y += taille * 0.45 + 2;
  }

  function corps(texte: string, taille = 9.5, indent = 0) {
    doc.setFont("helvetica", "normal").setFontSize(taille).setTextColor(...ENCRE);
    for (const bloc of texte.split("\n")) {
      if (!bloc.trim()) {
        y += 2;
        continue;
      }
      for (const l of doc.splitTextToSize(bloc, LARGEUR - indent)) {
        place(6);
        doc.text(l, X + indent, y);
        y += taille * 0.45;
      }
    }
  }

  function puces(liste: string[], taille = 9) {
    doc.setFont("helvetica", "normal").setFontSize(taille).setTextColor(...ENCRE);
    for (const item of liste) {
      const lignes = doc.splitTextToSize(item, LARGEUR - 8);
      lignes.forEach((l: string, i: number) => {
        place(6);
        if (i === 0) doc.text("•", X + 2, y);
        doc.text(l, X + 7, y);
        y += taille * 0.45;
      });
      y += 1;
    }
  }

  /** Bloc encadré à en-tête gris, comme les tableaux du document officiel. */
  function encadre(entete: string, contenu: string) {
    if (!contenu?.trim()) return;
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(9);
    const hEntete = 7;
    doc.setFont("helvetica", "normal").setFontSize(9);
    const lignes = doc.splitTextToSize(contenu, LARGEUR - 6);
    const hCorps = lignes.length * 4.1 + 4;
    place(hEntete + hCorps);

    doc.setFillColor(...FOND);
    doc.rect(X, y, LARGEUR, hEntete, "F");
    doc.setDrawColor(...TRAIT).setLineWidth(0.2);
    doc.rect(X, y, LARGEUR, hEntete);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...ENCRE);
    doc.text(entete, X + 3, y + 4.8);
    y += hEntete;

    doc.rect(X, y, LARGEUR, hCorps);
    doc.setFont("helvetica", "normal").setFontSize(9);
    lignes.forEach((l: string, i: number) => doc.text(l, X + 3, y + 5 + i * 4.1));
    y += hCorps;
  }

  /** Ligne de tableau à colonnes libres. */
  function ligne(
    cells: { texte: string; largeur: number; gras?: boolean; fond?: boolean; centre?: boolean }[],
    taille = 8.5,
  ) {
    doc.setFontSize(taille);
    const h = Math.max(
      7,
      ...cells.map(
        (c) => doc.splitTextToSize(c.texte || " ", c.largeur - 3).length * 3.9 + 3,
      ),
    );
    place(h);
    let x = X;
    for (const c of cells) {
      if (c.fond) {
        doc.setFillColor(...FOND);
        doc.rect(x, y, c.largeur, h, "F");
      }
      doc.setDrawColor(...TRAIT).setLineWidth(0.2);
      doc.rect(x, y, c.largeur, h);
      doc
        .setFont("helvetica", c.gras ? "bold" : "normal")
        .setFontSize(taille)
        .setTextColor(...ENCRE);
      const lignes = doc.splitTextToSize(c.texte || "", c.largeur - 3);
      lignes.forEach((l: string, i: number) =>
        doc.text(l, c.centre ? x + c.largeur / 2 : x + 1.5, y + 4.2 + i * 3.9, {
          align: c.centre ? "center" : "left",
        }),
      );
      x += c.largeur;
    }
    y += h;
  }

  // ══ Page de garde ═══════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...GRIS);
  doc.text("Office de la Formation Professionnelle", X, 40);
  doc.text("et de la Promotion du Travail", X, 46);

  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(...ENCRE);
  doc.text("Guide de soutien", X, 92);
  doc.text("pédagogique", X, 105);

  doc.setFont("helvetica", "normal").setFontSize(15);
  doc.text(`Compétence N°${m.numero}`, X, 124);
  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.splitTextToSize(m.nom, LARGEUR).forEach((l: string, i: number) =>
    doc.text(l, X, 134 + i * 8),
  );

  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GRIS);
  doc.text(`Secteur : Digital & IA`, X, 175);
  doc.text(`${m.filiere} — Technicien Spécialisé`, X, 182);
  if (m.groupeNom) {
    doc.text(
      `Groupe ${m.groupeNom} · masse horaire allouée ${heures(m.masseHoraire)}`,
      X,
      189,
    );
  }

  // ══ 1. Fiches prescriptives ═════════════════════════════════════════════
  doc.addPage();
  y = HAUT;
  titre("1. Fiches prescriptives et suggestions pédagogiques", 15, 0);

  titre("1.1 Informations générales", 12);
  corps(
    `Compétence ${m.numero} : ${m.nom}\n` +
      `Code : ${m.codeOfficiel ?? "—"}     Durée : ${m.dureeNationale ?? "—"} heures\n` +
      `Théorique : ${m.pctTheorique} %     Pratique : ${m.pctPratique} %     Évaluation : ${m.pctEvaluation} %`,
  );

  encadre("ÉNONCÉ DE LA COMPÉTENCE", m.enonce ?? "");
  encadre("DESCRIPTION GÉNÉRALE DU COURS", m.descriptionGenerale ?? "");
  encadre("CONTEXTE DE RÉALISATION", m.contexteRealisation ?? "");
  encadre("CRITÈRES GÉNÉRAUX DE PERFORMANCE", m.criteresGeneraux ?? "");

  titre("OBJECTIF OPÉRATIONNEL", 11);
  const lEl = 70;
  ligne([
    { texte: "ÉLÉMENTS DE LA COMPÉTENCE", largeur: lEl, gras: true, fond: true },
    {
      texte: "CRITÈRES PARTICULIERS DE PERFORMANCE",
      largeur: LARGEUR - lEl,
      gras: true,
      fond: true,
    },
  ]);
  for (const el of m.elements) {
    ligne([
      { texte: `${el.lettre}. ${el.intitule}`, largeur: lEl },
      {
        texte: el.criteres.map((c) => `• ${c}`).join("\n"),
        largeur: LARGEUR - lEl,
      },
    ]);
  }

  // ── 1.2 Suggestions pédagogiques ────────────────────────────────────────
  doc.addPage();
  y = HAUT;
  titre("1.2 Suggestions pédagogiques", 12, 0);

  const c1 = 34, c2 = 40, c3 = 44, c4 = 44, c5 = LARGEUR - c1 - c2 - c3 - c4;
  ligne([
    { texte: "ÉLÉMENTS DE LA COMPÉTENCE", largeur: c1, gras: true, fond: true },
    { texte: "APPRENTISSAGES DE BASE", largeur: c2, gras: true, fond: true },
    { texte: "ÉLÉMENTS DE CONTENU", largeur: c3, gras: true, fond: true },
    { texte: "ACTIVITÉS D'APPRENTISSAGE", largeur: c4, gras: true, fond: true },
    { texte: "DURÉE", largeur: c5, gras: true, fond: true, centre: true },
  ]);
  let lettreVue = "";
  for (const o of m.objectifs) {
    const el = m.elements.find((e) => e.lettre === o.lettre);
    const premier = o.lettre !== lettreVue;
    lettreVue = o.lettre;
    ligne([
      {
        texte: premier ? `${el?.lettre}. ${el?.intitule ?? ""}` : "",
        largeur: c1,
      },
      { texte: `${o.code} ${o.intitule}`, largeur: c2 },
      { texte: o.contenu ?? "", largeur: c3 },
      { texte: o.activites ?? "", largeur: c4 },
      {
        texte: o.pourcent != null ? `${o.pourcent} %` : "",
        largeur: c5,
        centre: true,
      },
    ]);
  }

  // ══ 2. Stratégie pédagogique ════════════════════════════════════════════
  doc.addPage();
  y = HAUT;
  titre("2. Stratégie pédagogique", 15, 0);
  titre("2.1 Stratégie pédagogique", 12);
  for (const bloc of STRATEGIE) {
    titre(bloc.titre, 10, 5);
    if (bloc.intro) {
      corps(bloc.intro, 9);
      y += 1;
    }
    puces(bloc.puces);
  }

  // ── 2.2 Plan de déroulement ─────────────────────────────────────────────
  doc.addPage();
  y = HAUT;
  titre("2.2 Plan de déroulement du module", 12, 0);
  titre("2.2.1 Répartition horaire", 10, 4);

  if (m.groupeNom) {
    corps(
      `Groupe ${m.groupeNom} — masse horaire allouée : ${heures(m.masseHoraire)}.`,
      9,
    );
    y += 2;
  }

  const o1 = 74, o2 = 22, o3 = 22, o4 = 22;
  const o5 = (LARGEUR - o1 - o2 - o3 - o4) / 3;
  ligne([
    { texte: "Objectif d'apprentissage", largeur: o1, gras: true, fond: true },
    { texte: "Théorique", largeur: o2, gras: true, fond: true, centre: true },
    { texte: "Pratique", largeur: o3, gras: true, fond: true, centre: true },
    { texte: "Total", largeur: o4, gras: true, fond: true, centre: true },
    { texte: "Prés.", largeur: o5, gras: true, fond: true, centre: true },
    { texte: "Sync.", largeur: o5, gras: true, fond: true, centre: true },
    { texte: "Async.", largeur: o5, gras: true, fond: true, centre: true },
  ]);

  let totalT = 0;
  let totalP = 0;
  for (const o of m.objectifs) {
    totalT += o.heuresTheoriques ?? 0;
    totalP += o.heuresPratiques ?? 0;
    const total =
      o.heuresTheoriques === null && o.heuresPratiques === null
        ? null
        : (o.heuresTheoriques ?? 0) + (o.heuresPratiques ?? 0);
    ligne([
      { texte: `${o.code} ${o.intitule}`, largeur: o1 },
      { texte: heures(o.heuresTheoriques), largeur: o2, centre: true },
      { texte: heures(o.heuresPratiques), largeur: o3, centre: true },
      { texte: heures(total), largeur: o4, gras: true, centre: true },
      { texte: o.presentiel ? "X" : "", largeur: o5, centre: true },
      { texte: o.synchrone ? "X" : "", largeur: o5, centre: true },
      { texte: o.asynchrone ? "X" : "", largeur: o5, centre: true },
    ]);
  }

  if (m.groupeNom) {
    const evaluation = (m.masseHoraire ?? 0) - totalT - totalP;
    ligne([
      { texte: "Évaluation (contrôles continus et EFM)", largeur: o1, gras: true },
      { texte: "", largeur: o2 },
      { texte: "", largeur: o3 },
      { texte: heures(evaluation), largeur: o4, gras: true, centre: true },
      { texte: "", largeur: o5 },
      { texte: "", largeur: o5 },
      { texte: "", largeur: o5 },
    ]);
    ligne([
      { texte: "TOTAL", largeur: o1, gras: true, fond: true },
      { texte: heures(totalT), largeur: o2, gras: true, fond: true, centre: true },
      { texte: heures(totalP), largeur: o3, gras: true, fond: true, centre: true },
      {
        texte: heures(m.masseHoraire),
        largeur: o4,
        gras: true,
        fond: true,
        centre: true,
      },
      { texte: "", largeur: o5, fond: true },
      { texte: "", largeur: o5, fond: true },
      { texte: "", largeur: o5, fond: true },
    ]);
  }

  // ── Pieds de page ───────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRIS);
    doc.text(
      `MANUEL FORMATEUR — COMPÉTENCE ${m.numero} — ${m.filiere.toUpperCase()} — OFPPT`,
      X,
      285,
      { maxWidth: LARGEUR - 20 },
    );
    doc.text(`${p}`, X + LARGEUR, 285, { align: "right" });
  }

  return doc;
}

export async function telechargerManuelPdf(m: Manuel, nomFichier: string) {
  const doc = await construireManuelPdf(m);
  doc.save(nomFichier);
}
