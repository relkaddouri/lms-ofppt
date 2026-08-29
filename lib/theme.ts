/**
 * Palette en valeurs littérales, pour les rendus qui ne lisent pas le CSS.
 *
 * jsPDF ne connaît ni les variables CSS ni Tailwind : il lui faut des hex.
 * C'est la seule raison d'être de ce fichier, et la seule duplication tolérée
 * de la palette — elle doit rester alignée sur `app/globals.css` et sur
 * docs/new_design/Planche de style OFPPT.dc.html.
 */
export const theme = {
  // Identité
  ink: "#2E3B4E",
  inkDark: "#25303F",
  coral: "#E2574C",
  coralDark: "#B8433A",
  green: "#3C8C5C",
  greenDark: "#2C6C46",
  teal: "#2E7D9E",
  tealDark: "#245F79",

  // Surfaces
  paper: "#F6F7F9",
  paperAlt: "#FAFBFC",
  surface: "#FFFFFF",
  wash: "#EFF2F5",
  washStrong: "#F2F4F7",

  // Bordures
  border: "#E3E7EC",
  borderStrong: "#C9D2DC",

  // Échelle de texte
  body: "#3F4E62",
  slate2: "#5B6A7D",
  slate: "#6B7A8D",
  slateLight: "#8C99A8",
  muted: "#A9B4C0",

  // Fond des états actifs, et filet interne des cartes
  mint: "#EDF0F3",
  separator: "#EDF0F3",

  // Teintes de statut
  bgSuccess: "#EAF3EE",
  bgAlert: "#FCEDEB",
  tintTeal: "#E8F2F7",
  tintGreen: "#CFE4D8",

  // Statuts (texte)
  success: "#3C8C5C",
  danger: "#E2574C",
  neutral: "#6B7A8D",
  info: "#2E7D9E",

  /**
   * Alias de transition, le temps que les écrans soient refaits un par un :
   * `forest` était la couleur primaire de la v2, `forestLight` le second point
   * du dégradé des graphiques. La maquette du tableau de bord n'utilise plus
   * de dégradé — ces deux noms disparaîtront avec l'atome de refonte du
   * tableau de bord.
   */
  forest: "#2E3B4E",
  forestLight: "#2E7D9E",
} as const;

export default theme;
