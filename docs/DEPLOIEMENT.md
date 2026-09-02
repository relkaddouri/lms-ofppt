# Déploiement — Vercel

## Une fois pour toutes

Les deux commandes qui demandent votre compte, à lancer depuis la racine du
projet :

```bash
npx vercel login
```

```bash
npx vercel link
```

`link` crée `.vercel/` (déjà ignoré par git) et rattache ce dossier à un
projet Vercel. Répondez « create a new project » si le projet n'existe pas
encore ; le préréglage Next.js est détecté seul, rien à configurer.

## Variables d'environnement

À poser dans **Vercel → Settings → Environment Variables**, pour
*Production* et *Preview*. Leurs valeurs sont celles de votre `.env.local`,
qui n'est jamais commité.

### Indispensables — l'application ne démarre pas sans

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique, bornée par la RLS |
| `SUPABASE_SECRET_KEY` | Clé serveur. Elle contourne la RLS : jamais exposée au navigateur, jamais commitée |

### Nécessaires aux invitations de stagiaires

| Variable | Rôle |
|---|---|
| `RESEND_API_KEY` | Envoi des courriels d'invitation |
| `RESEND_FROM` | Adresse d'expédition vérifiée chez Resend |
| `NEXT_PUBLIC_SITE_URL` | L'URL de production, par exemple `https://pedago.vercel.app`. **Sans elle, les liens d'invitation sont construits depuis l'en-tête `Host` de la requête** — ce qui marche derrière Vercel, mais casse dès qu'un proxy réécrit l'hôte. À poser explicitement une fois l'URL connue. |

### Aucune clé de modèle de langage ici

Le fournisseur d'IA n'est pas une variable d'environnement : chaque formateur
enregistre sa propre clé depuis **Paramètres → Modèle de langage**, et elle
est chiffrée dans le Vault Supabase. Rien à poser côté Vercel.

## Après le premier déploiement

1. Dans **Supabase → Authentication → URL Configuration**, ajouter l'URL de
   production à *Site URL* et à *Redirect URLs* — sinon les liens de
   réinitialisation et d'invitation reviennent sur `localhost`.
2. Poser `NEXT_PUBLIC_SITE_URL` avec cette même URL, puis redéployer.
3. Vérifier la connexion formateur, puis la connexion d'un compte stagiaire.

## Les migrations ne partent pas avec le déploiement

Vercel ne pousse que le code. Le schéma se met à jour à part :

```bash
npx supabase db push --linked
```

À lancer avant le déploiement quand une migration accompagne le code.
