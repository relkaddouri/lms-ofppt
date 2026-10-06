@AGENTS.md
## Règles de performance (hébergement Vercel)

Sur Vercel, on paie chaque exécution du serveur. Une petite tâche répétée des milliers de fois coûte plus cher qu'une grosse tâche occasionnelle.

- Jamais de setInterval ou de vérification en boucle qui appelle le serveur. Pour le temps réel, utiliser Supabase Realtime. Si une vérification régulière est vraiment nécessaire : 5 minutes minimum, et pause quand l'onglet est caché (document.hidden).
- Ne sélectionner que les colonnes affichées. Jamais de JSON ou de texte long si on n'affiche pas son contenu.
- Pour un compteur : utiliser count, pas une liste qu'on compte ensuite.
- Toute requête a une limite (limit).
- Les layouts tournent sur toutes les pages : y mettre le minimum.
- Le rôle de l'utilisateur est dans le jeton (custom claims), pas relu en base à chaque page.
- Le proxy/middleware exclut /api/, _next, les images et les polices. Il ne fait que rafraîchir la session.
- Mettre en cache ce qui ne dépend ni de l'utilisateur ni de la minute (revalidate, unstable_cache).
- PDF, graphiques et traitements lourds : dans le navigateur quand c'est possible.
- Server Actions : pour écrire des données, pas pour vérifier en boucle.
- Ajouter app/robots.ts dès le premier déploiement.

Avant de proposer une fonctionnalité qui appelle le serveur souvent, préviens-moi du coût possible.