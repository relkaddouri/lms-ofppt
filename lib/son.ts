/**
 * Le carillon des nouveautés.
 *
 * Synthétisé plutôt que chargé depuis un fichier : deux notes tiennent en
 * quinze lignes, et un `.mp3` dans `public/` aurait ajouté un téléchargement,
 * un cache à invalider et un format à choisir — pour un son de deux dixièmes
 * de seconde. Il ne dépend d'aucun réseau, donc il sonne aussi quand la
 * connexion de l'établissement flanche.
 *
 * Deux notes montantes, brèves, sans réverbération : le son doit dire « il
 * s'est passé quelque chose » à quelqu'un qui a le téléphone sur la table,
 * sans s'entendre depuis la rangée d'à côté.
 */

/** Le contexte audio est unique : en créer un par appel les épuise (Safari). */
let contexte: AudioContext | null = null;
let deverrouille = false;

type FenetreAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function obtenirContexte(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Constructeur =
    window.AudioContext ?? (window as FenetreAudio).webkitAudioContext;
  if (!Constructeur) return null;
  contexte ??= new Constructeur();
  return contexte;
}

/**
 * Prépare le son au premier geste de l'utilisateur.
 *
 * Les navigateurs refusent tout son tant que la personne n'a pas touché la
 * page — une règle qui vise les publicités et qu'on ne contourne pas. Le
 * premier appui, où qu'il soit, réveille le contexte ; sans cela, la première
 * notification arriverait muette et le carillon ne marcherait qu'à partir de
 * la deuxième.
 */
export function preparerSon(): () => void {
  if (typeof window === "undefined") return () => {};

  const reveiller = () => {
    const ctx = obtenirContexte();
    if (!ctx) return;
    void ctx.resume().then(() => {
      deverrouille = true;
    });
  };

  window.addEventListener("pointerdown", reveiller, { once: true });
  window.addEventListener("keydown", reveiller, { once: true });
  return () => {
    window.removeEventListener("pointerdown", reveiller);
    window.removeEventListener("keydown", reveiller);
  };
}

/** Une note : sinus pur, attaque immédiate, extinction exponentielle. */
function note(
  ctx: AudioContext,
  frequence: number,
  depart: number,
  duree: number,
  volume: number,
): void {
  const oscillateur = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillateur.type = "sine";
  oscillateur.frequency.value = frequence;

  // L'attaque n'est pas instantanée : à zéro, la discontinuité s'entend comme
  // un claquement sur les petits haut-parleurs de téléphone.
  gain.gain.setValueAtTime(0.0001, depart);
  gain.gain.exponentialRampToValueAtTime(volume, depart + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, depart + duree);

  oscillateur.connect(gain).connect(ctx.destination);
  oscillateur.start(depart);
  oscillateur.stop(depart + duree + 0.02);
}

/**
 * Joue le carillon. Ne fait rien si le navigateur le refuse encore.
 *
 * Silencieux en cas d'échec : un son raté n'est pas un incident, et la
 * pastille rouge dit déjà la même chose à l'œil.
 */
export function jouerCarillon(): void {
  const ctx = obtenirContexte();
  if (!ctx) return;

  const jouer = () => {
    const t = ctx.currentTime;
    // La ♭ puis Do — une tierce montante, la formule de toutes les sonneries
    // d'arrivée : elle ouvre, là où une tierce descendante clôt.
    note(ctx, 880, t, 0.13, 0.22);
    note(ctx, 1174.66, t + 0.085, 0.22, 0.18);
  };

  if (ctx.state === "suspended") {
    if (!deverrouille) return;
    void ctx.resume().then(jouer).catch(() => {});
    return;
  }
  jouer();
}
