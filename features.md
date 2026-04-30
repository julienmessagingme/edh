# Features — EDH Stats

> Vue produit, sans détail technique. Pour la doc tech : `documentation.md`.

## Authentification

- Login email + mot de passe.
- 2 utilisateurs : Julien et EDH, mêmes droits.
- Session 7 jours, cookie HttpOnly.
- Pas de signup UI, pas de reset password (outil interne, comptes seedés).

**Statut :** ✅ livré.

## Switch d'école (sidebar)

- Sidebar gauche fixe avec les 9 écoles : EFAP, 3WA, Brassart, CESINE, EJF, ESEC, École Bleue, ICART, IFA.
- Cliquer une école change le contexte de toute l'app — URLs et Stats se filtrent automatiquement sur l'école sélectionnée.
- Le choix persiste 1 an dans un cookie. Au premier login, on est par défaut sur EFAP.
- Bouton « Se déconnecter » en bas de la sidebar.

**Statut :** ✅ livré.

## Onglet « URLs »

- Liste de toutes les URLs trackées de l'école courante (les autres écoles sont invisibles).
- **Créer un événement** : nom (label libre, ex `template_CESINE`) + URL de destination → l'app génère un slug aléatoire 8 chars. L'URL `edh.messagingme.app/r/<slug>` est immédiatement utilisable dans un template WhatsApp.
- **Modifier la destination** : crée une nouvelle version (le slug ne change jamais). Les clics futurs sont attribués à la nouvelle version. L'historique par version est conservé.
- **Renommer** : change le label, pas le slug.
- **Archiver** : la card disparaît de la liste, mais le redirect continue de marcher (utile si un template Meta reste actif pour les contacts qui n'ont pas encore cliqué).
- Compteur de clics + dernier clic affichés sur chaque card.

**Statut :** ⏳ Phase 5 à venir.

## Redirect public

- L'URL `edh.messagingme.app/r/<slug>` est ouverte (pas d'auth, c'est ce que les contacts WhatsApp cliquent).
- Chaque clic est compté individuellement (timestamp, IP, user-agent, referer).
- Latence cible <50ms.
- Rate-limit anti-abus : 100 hits/IP/min.
- Si le slug est inconnu ou archivé : page 404 propre.
- Si la base est down : message « Service indisponible » (503), jamais d'erreur 500 brute.

**Statut :** ✅ livré (Phase 4).

## Onglet « Stats »

- Sélecteur de période en haut : presets 7j / 30j / 90j + custom (deux date pickers).
- Liste accordéons : un accordéon par custom event MessagingMe de l'école courante.
- Quand on ouvre un accordéon :
  - Histogramme journalier des occurrences en Europe/Paris.
  - Dropdown « Comparer avec… » qui liste les URLs trackées de la même école.
  - En sélectionnant une URL : bar chart à 2 séries (occurrences + clics) + courbe du taux de clic quotidien (clics/occurrences).
  - Bandeau résumé : taux global, taux moyen quotidien, totaux.
- Bouton « ⟳ Re-sync » en bas pour relancer un sync manuel hors de 22:00.
- Affiche aussi la date du dernier sync MessagingMe.

**Statut :** ⏳ Phase 7 à venir.

## Sync MessagingMe quotidien

- Cron interne 22:00 Europe/Paris dans le process Next.js.
- Synchronise séquentiellement les 9 écoles avec leurs bearer tokens respectifs.
- Refresh la liste des custom events de chaque école.
- Pour chaque event, ingest les nouvelles occurrences depuis le dernier sync (watermark sur l'id messagingme, du plus récent vers le plus ancien jusqu'à recroiser l'id déjà ingéré).
- Si un event ou une école fail, les autres continuent. L'erreur est loggée dans `mm_sync_state.last_run_error` et visible dans l'UI (« dernier sync : ⚠️ erreur »).
- Trigger manuel possible via le bouton ⟳ ou via `POST /api/cron/sync` avec Bearer interne.

**Statut :** ⏳ Phase 6 à venir.

## Hébergement

- Une seule app, un seul container Docker, sur le VPS OVH derrière NPM.
- Sous-domaine `edh.messagingme.app` (DNS Cloudflare A record proxied).
- Déploiement par `git pull && docker compose up -d --build` sur le VPS.

**Statut :** ⏳ Phase 8-9 à venir.
