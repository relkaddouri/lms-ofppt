/**
 * Le texte du cahier du formateur, mot pour mot.
 *
 * Ces pages ne viennent pas de la plateforme : ce sont les procédures de
 * l'OFPPT, identiques d'un formateur à l'autre et d'une année à l'autre. Elles
 * sont donc écrites ici une fois, et non recopiées à la main dans Word à
 * chaque édition.
 *
 * Extrait du cahier officiel sans rien reformuler. Seuls les espaces doubles
 * de la saisie d'origine ont été ramenés à un : les mots sont inchangés.
 *
 * `genre` dit comment le paragraphe se présente, pas ce qu'il dit — c'est
 * l'assembleur qui choisit la police et l'espacement (`docx-charte.ts`).
 */

export type BlocTexte = {
  genre: "titre1" | "titre2" | "paragraphe" | "puce";
  texte: string;
};

/** Les procédures d'utilisation, telles qu'elles ouvrent le cahier officiel. */
export const PROCEDURES: BlocTexte[] = [
  { genre: "paragraphe", texte: "Le cahier du formateur s'inscrit dans le cadre de la poursuite des efforts de l'OFPPT pour la mise en place de la démarche qualité dans les établissements de formation." },
  { genre: "paragraphe", texte: "Il constitue un outil d'aide pour le formateur pour la gestion de la formation en lui permettant:" },
  { genre: "puce", texte: "De planifier et de suivre la formation et les évaluations;" },
  { genre: "puce", texte: "De disposer d'une meilleure traçabilité des événements pédagogiques des filières dont il a la charge;" },
  { genre: "paragraphe", texte: "Il est également un aide mémoire du formateur, lui permettant d'être proactif par rapport aux diverses activités de son établissement." },
  { genre: "paragraphe", texte: "Le cahier du formateur est composé de deux parties :" },
  { genre: "puce", texte: "La première est consacrée à la planification et au suivi de la formation;" },
  { genre: "puce", texte: "La deuxième est consacrée à la planification et au suivi des évaluations." },
  { genre: "titre1", texte: "I- Planification et suivi de la formation" },
  { genre: "titre2", texte: "A- Prise en charge des groupes et des modules de formation" },
  { genre: "paragraphe", texte: "Dans le cadre de la préparation de la rentrée, la Direction pédagogique et les formateurs procèdent à la répartition des modules de formation des filières et groupes dont ils auront la charge." },
  { genre: "paragraphe", texte: "L'affectation des modules prend en compte:" },
  { genre: "puce", texte: "Les Résultats des bilans de compétence;" },
  { genre: "puce", texte: "La spécialisation des formateurs et des espaces de formation;" },
  { genre: "puce", texte: "La masse horaire annuelle statutaire pour chaque formateur." },
  { genre: "paragraphe", texte: "Le formateur renseigne au début de l'année :" },
  { genre: "puce", texte: "le tableau des \"filières et groupes pris en charge\". Ce tableau lui permet également de suivre mensuellement l'effectif de chaque groupe." },
  { genre: "puce", texte: "Le tableau des modules pris en charge. Ce tableau lui donne une vision globale des modules, de leur masse horaire, de leur date de début et de fin." },
  { genre: "titre2", texte: "B- L'Emploi du temps" },
  { genre: "paragraphe", texte: "Après l'affectation des modules, la Direction pédagogique procède, en concertation avec les formateurs, à l'élaboration des emplois du temps. Chaque formateur reçoit son emploi du temps hebdomadaire et qui doit fait ressortir les indications suivantes :" },
  { genre: "puce", texte: "Période de validité de l'emploi du temps;" },
  { genre: "puce", texte: "Les horaires des séances de formation;" },
  { genre: "puce", texte: "Les filières et groupes concernés;" },
  { genre: "puce", texte: "Les noms des formateurs;" },
  { genre: "puce", texte: "Les modules à mettre en œuvre;" },
  { genre: "puce", texte: "Les espaces de formation." },
  { genre: "puce", texte: "L'émargement du responsable pédagogique" },
  { genre: "paragraphe", texte: "L'emploi du temps est variable, il est valable pour une période donnée. Si des changements interviennent dans les horaires, dans l'affectation des groupes, des espaces ou des modules de formation, l'emploi du temps est réédité pour tenir compte de ces changements." },
  { genre: "titre2", texte: "C- Le logigramme de la filière" },
  { genre: "paragraphe", texte: "Le logigramme de la filière est un document pédagogique qui permet à chaque formateur intervenant de connaître l'articulation entre les modules et le rythme d'avancement prévu pour chaque module. Il précise la masse horaire hebdomadaire allouée aux différents modules et le nombre de semaines nécessaire pour terminer un module donné. Dans le cas ou la filière dispose d'un logigramme, la direction pédagogique et les formateurs de la filière procèdent à son adaptation au contexte de leur établissement. Dans le cas contraire, le logigramme doit être est élaboré en respectant les consignes suivantes:" },
  { genre: "puce", texte: "L'ordre de succession logique des modules;" },
  { genre: "puce", texte: "La masse horaire hebdomadaire du module qui favorise l'apprentissage;" },
  { genre: "puce", texte: "L'optimisation des espaces de formation;" },
  { genre: "paragraphe", texte: "Le formateur récupère le logigramme de la filière et le colle dans la partie réservée à cet effet." },
  { genre: "titre2", texte: "D- La séance de formation" },
  { genre: "paragraphe", texte: "La séance constitue l'unité de base de la formation, chaque module de formation donnera lieu à un découpage en séances de formation." },
  { genre: "paragraphe", texte: "La durée d'une séance varie de 1 heure à 5 heures." },
  { genre: "puce", texte: "Les séances théoriques ne peuvent dépasser 3 heures;" },
  { genre: "puce", texte: "Les séances pratiques ne peuvent être inférieur à 2 heures" },
  { genre: "paragraphe", texte: "L'exploitation des guides de la filière permet au formateur de dégager les objectifs opérationnels de chaque séance et le nombre de séances nécessaires pour atteindre les objectifs du module." },
  { genre: "paragraphe", texte: "Avant d'entamer la formation, le formateur renseigne la fiche Planification et suivi des modules de formation en indiquant l'objectifs opérationnel, la date et la durée de chaque séance." },
  { genre: "paragraphe", texte: "Lors du déroulement de la formation et à la fin de chaque séance, le formateur renseigne la partie réservée aux réalisations (date de réalisation; contenu réalisé ; durée cumul des heures réalisées; noms des stagiaires absents). Il peut éventuellement ajouter ce que les stagiaires doivent préparer pour la prochaine séance." },
  { genre: "titre2", texte: "E - La fiche préparation" },
  { genre: "paragraphe", texte: "La fiche préparation constitue un guide pour que le formateur puisse bien mener l'apprentissage des stagiaires pendant la séance de formation. Elle comprend la structure du contenu de la leçon organisé sous forme d’accroches pour la mémoire. Elle ne doit en aucun cas comprendre des détails du cours. C’est un schéma de la leçon, composé des mots clés, d’idées clés, d’exemples, d’éléments importants à ne pas oublier." },
  { genre: "paragraphe", texte: "Pour chaque séance, le formateur élabore au préalable une fiche de préparation selon le modèle en annexe." },
  { genre: "titre1", texte: "II- Planification et suivi des évaluations" },
  { genre: "titre2", texte: "A - Les contrôles continus" },
  { genre: "paragraphe", texte: "Si le formateur à toute la liberté d'utiliser les évaluations formatives orales en fonction de son jugement sur le degré d'évolution de l'apprentissage des stagiaires. Les contrôles continus écrits ou en travaux pratiques doivent d'être planifiés au préalable et respecter les consignes suivantes :" },
  { genre: "puce", texte: "La date doit coïncider avec une évolution significative de la formation;" },
  { genre: "puce", texte: "Pour chaque module, au moins 2 contrôles continus doivent être prévus;" },
  { genre: "puce", texte: "L'épreuve doit être préparée à l'avance par écrit et comprendre la durée et le barème de notation;" },
  { genre: "puce", texte: "La durée du contrôle continu doit être dimensionnée correctement pour que les stagiaires puissent être imprégnés de l'importance de la notion du temps dans leurs réalisations;" },
  { genre: "puce", texte: "Le corrigé du contrôle continu est réalisé immédiatement après l'administration de celui-ci;" },
  { genre: "puce", texte: "Les notes doivent obligatoirement être restituées aux stagiaires et au plus tard la deuxième séance qui suit le contrôle continu;" },
  { genre: "paragraphe", texte: "La partie prévision du tableau de planification et de suivi de réalisation des contrôles continus, est renseignée par le formateur au début de la formation." },
  { genre: "paragraphe", texte: "Les dates effectives d'administration des contrôles continus et les notes des stagiaires sont reportées au fur et à mesure de leur réalisation." },
  { genre: "titre2", texte: "B- Les examens de fin de modules" },
  { genre: "paragraphe", texte: "Chaque module de formation doit obligatoirement être sanctionné par un EFM écrit et intervenir lorsque le module est achevé ou au plus tard 10 jours après son achèvement. L'organisation des EFM doit respecter les consignes suivantes :" },
  { genre: "puce", texte: "La planification des EFM est réalisée au début de l'année par le formateur concerné et prévoit les dates de remise des propositions et les dates d'administration des EFM;" },
  { genre: "puce", texte: "La planification des EFM doit être validée par la Direction Pédagogique et reportée par le formateur dans le tableau de Planification et suivi de réalisation des EFM;" },
  { genre: "puce", texte: "Les propositions des EFM sont conçues par les formateurs concernés et validées par une commission des formateurs de la spécialité, présidée par le directeur pédagogique 20 jours avant l'administration des EFM;" },
  { genre: "puce", texte: "Les stagiaires doivent être informés au préalable de la date et du lieu des EFM;" },
  { genre: "puce", texte: "Les copies corrigées et les notes des stagiaires sont restituées à la Direction pédagogique, au plus tard 10 jours après l'administration de l'EFM;" },
  { genre: "puce", texte: "Les résultats des EFM sont portés par affichage à la connaissance des stagiaires au plus tard 15 jours après leur administration." },
];
