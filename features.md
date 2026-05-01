# Features — EDH Stats

> Vue produit, sans détail technique. Pour la doc tech : `documentation.md`.

## Authentification

- Login email + mot de passe.
- 2 utilisateurs : Julien et EDH, mêmes droits.
- Session 7 jours, cookie HttpOnly.
- Pas de signup UI, pas de reset password (outil interne, comptes seedés).

**Statut :** ✅ livré.

## Switch d'école (sidebar)

- Sidebar gauche fixe avec les 9 écoles (logo + nom) : EFAP, 3WA, Brassart, CESINE, EFJ, ESEC, École Bleue, ICART, IFA. Logo du groupe EDH en haut à gauche du header, tabs `[Stats] [Base de connaissance]` immédiatement à droite.
- Cliquer une école change le contexte de toute l'app — URLs et Stats se filtrent automatiquement sur l'école sélectionnée.
- Le choix persiste 1 an dans un cookie. Au premier login, on est par défaut sur EFAP.
- Bouton « Se déconnecter » en bas de la sidebar.

**Statut :** ✅ livré.

## Onglets de niveau 1

Le header du dashboard expose deux grands modes :

- **Stats** (par défaut) — pilote les URLs trackées, l'analytics MessagingMe et les tableaux personnalisés. Sous-nav : `[URLs] [Stats] [Mes tableaux]`.
- **Base de connaissance** — alimente le vector store OpenAI de l'école courante (voir plus bas).

Le contexte d'école (sidebar gauche) s'applique aux deux modes.

**Statut :** ✅ livré.

## Onglet « URLs »

- Liste de toutes les URLs trackées de l'école courante (les autres écoles sont invisibles).
- **Créer un événement** : nom (label libre, ex `template_CESINE`) + URL de destination → l'app génère un slug aléatoire 8 chars. L'URL `edh.messagingme.app/r/<slug>` est immédiatement utilisable dans un template WhatsApp.
- **Modifier la destination** : crée une nouvelle version (le slug ne change jamais). Les clics futurs sont attribués à la nouvelle version. L'historique par version est conservé.
- **Renommer** : change le label, pas le slug.
- **Archiver** : la card disparaît de la liste, mais le redirect continue de marcher (utile si un template Meta reste actif pour les contacts qui n'ont pas encore cliqué).
- Compteur de clics + dernier clic affichés sur chaque card.

**Statut :** ✅ livré.

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

**Statut :** ✅ livré.

## Sync MessagingMe quotidien

- Cron interne 22:00 Europe/Paris dans le process Next.js.
- Synchronise séquentiellement les 9 écoles avec leurs bearer tokens respectifs.
- Refresh la liste des custom events de chaque école.
- Pour chaque event, ingest les nouvelles occurrences depuis le dernier sync (watermark sur l'id messagingme, du plus récent vers le plus ancien jusqu'à recroiser l'id déjà ingéré).
- Si un event ou une école fail, les autres continuent. L'erreur est loggée dans `mm_sync_state.last_run_error` et visible dans l'UI (« dernier sync : ⚠️ erreur »).
- Trigger manuel possible via le bouton ⟳ ou via `POST /api/cron/sync` avec Bearer interne.

**Statut :** ✅ livré.

## Onglet « Base de connaissance »

Un vector store OpenAI par école. Quand on uploade un fichier, un texte ou une Q/R, il est indexé directement dans le vector store de l'école courante.

**Sous-onglets de saisie** (4 modes) :

- **Fichier PDF/TXT** : drag-and-drop d'un PDF ou d'un fichier texte (max 10 Mo). Validation magic bytes côté serveur — un PDF déguisé en .txt (ou inversement) est rejeté.
- **Saisie manuelle** : titre + textarea (jusqu'à 200 000 caractères). Conversion automatique en PDF avant indexation.
- **Question / Réponse** : champs question + réponse, avec sélection optionnelle de thème et sous-thème. Génère un fichier .txt structuré (`THÈME / SOUS-THÈME / QUESTION / RÉPONSE`). Boutons `+` pour créer un thème ou sous-thème inline.
- **Import Excel** : drop d'un .xlsx/.xls. Choix de la feuille, de la ligne d'en-tête, et des colonnes (Question, Réponse, Thème, Sous-thème). Aperçu 5 lignes. Import en masse avec barre de progression en temps réel (Server-Sent Events). Retry x3 par ligne en cas d'erreur transitoire. Bouton « Annuler » qui interrompt le streaming.

**Détection de doublons** : à chaque création / modification de Q/R, l'app vérifie qu'aucune autre Q/R de la même école n'a la même question ou la même réponse exacte. Si oui : erreur claire avec le champ en cause.

**Thèmes / sous-thèmes** : boutton « Gérer les thèmes » ouvre une modale 2 panneaux. CRUD complet par école (un thème de EFAP n'apparaît pas pour ICART). Supprimer un thème → ses sous-thèmes sont supprimés aussi (cascade), les Q/R associées perdent leur thème mais restent.

**Historique** : sous les onglets de saisie, liste paginée de tous les éléments uploadés pour l'école courante.

- Filtres : `[Tous] [Fichiers] [Textes] [Q/R]`
- Recherche full-text (sur question, réponse, titre, nom de fichier) — debounced 300 ms.
- Pour chaque élément : type, contenu (question + réponse pour les Q/R, titre + nom pour les autres), thème/sous-thème si applicable, timestamp, badge d'indexation (en cours / échoué / silencieux si terminé).
- Boutons par élément : modifier (Q/R uniquement, pattern delete-then-recreate côté OpenAI) et supprimer.
- Polling auto toutes les 5 s tant qu'un élément récent (< 60 s) est en cours d'indexation.

**Switch d'école** : tout est rechargé sur la nouvelle école. La recherche, la page courante et les filtres se conservent.

**Statut :** ✅ livré.

## Mes tableaux (custom dashboards)

Troisième sous-onglet de Stats. Chaque user UI (Julien, EDH) construit ses propres tableaux de pilotage par école, persistés en DB et privés à leur créateur (personne d'autre ne les voit).

**Page liste `/dashboards`** :

- Grille de cards : nom du tableau, type (funnel pour V1), date de dernière modification.
- Bouton « + Nouveau funnel » → modal qui demande juste un nom → ouvre le builder.
- Icône poubelle par card pour supprimer.

**Builder `/dashboards/[id]`** :

- En haut : nom éditable inline, sélecteurs de période (presets `7j / 30j / 90j` + dates `du / au` custom), bouton « Supprimer ».
- À gauche, palette en deux sections : `Custom events MM` (les events messagingme de l'école) et `Clics URL` (les URLs trackées non archivées de l'école). On glisse un item de la palette vers la zone d'étapes pour créer une nouvelle étape, ou vers une étape existante pour **cumuler** la source dans cette étape.
- Au milieu, zone funnel : les étapes choisies dans l'ordre. Chaque étape a un **label éditable** (placeholder = composition auto `A + B + C`), une badge `MM / URL / Mixte`, et une liste de **chips** pour ses sources. Bouton `+ Ajouter` dans chaque étape pour ajouter une source via menu déroulant. Drag-and-drop pour réordonner les étapes, ✕ pour retirer une chip (si dernière chip → l'étape entière est supprimée), poubelle pour supprimer toute l'étape. Une chip dont la source a disparu (event mm supprimé, URL archivée) s'affiche grisée.
- À droite, visualisation : bar chart horizontal recharts (longueur = volume **cumulé** des sources de l'étape), table récap (étape, volume, conversion vs étape précédente, conversion vs étape 1, breakdown des sources individuelles si > 1).
- Auto-save : chaque modif (renommage, ordre, étapes, sources, dates, label) est sauvegardée silencieusement après 500 ms (toast « Enregistrement… » discret en haut à droite).

**Étapes cumulées (rapports cumul)** : on peut empiler plusieurs sources dans une même étape — par exemple `relance benin V1` + `relance benin V2` + `relance ICART V1` formant l'étape `Relances`, dont le volume affiché = somme des trois. Mix mm + URL autorisé. Si une source disparaît, l'étape continue de fonctionner avec les sources restantes ; l'étape n'est marquée « indisponible » que si toutes ses sources ont disparu.

**Sémantique du funnel V1** : on compare des **volumes purs** d'occurrences sur la période. Pas de matching utilisateur entre étapes — c'est une vue esthétique pour repérer les ordres de grandeur et les ratios entre étapes consécutives, pas une analyse causale par utilisateur.

**Switch d'école** : la liste et le builder se rechargent automatiquement (pattern `key={schoolSlug}`). Si l'on est sur le builder d'un tableau qui appartient à une autre école que celle qui vient d'être sélectionnée, l'API renvoie 404 et on est redirigé vers `/dashboards` avec un toast.

**Statut :** ✅ livré.

## Administration des utilisateurs

Onglet niveau 1 `Admin` du header, **visible uniquement par les administrateurs** (Julien, Kelberg, Hassani au lancement). Les non-admins ne voient ni le tab ni l'URL `/admin` (404 si tentative directe).

**Page Admin** : grille de cards, une par utilisateur :

- Nom, email, badge `Admin` ou `Member`, badge `Vous` sur sa propre card, badge `Désactivé` rouge si applicable.
- Dernière connexion en relatif ("il y a 2h" / "jamais").
- Chips des écoles assignées à cet utilisateur (max 5 visibles, +N si plus).
- Bouton crayon → ouvre le modal de modification.
- Bouton désactiver (icône utilisateur barré) ou réactiver (icône utilisateur coché) à côté. Pas de bouton désactiver sur sa propre card.
- Bouton `+ Inviter` en haut à droite.

**Modal Inviter** : email + nom + mot de passe temporaire (auto-généré, copiable, régénérable à la volée) + grille des 9 écoles (toutes cochées par défaut, on décoche celles auxquelles on ne veut pas donner accès) + checkbox `Administrateur`. À la création, un toast affiche le mot de passe pendant 30 secondes pour qu'on puisse le copier-coller dans Slack/email vers la personne invitée.

**Modal Modifier** : email read-only (immuable), nom modifiable, champ optionnel "Nouveau mot de passe" (vide = inchangé), grille des écoles, checkbox admin.

**Désactivation (soft-delete)** : un user désactivé ne peut plus se logger (401 message générique au login), mais ses dashboards restent en DB pour audit. Réactivable à tout moment depuis la même page. On ne peut pas se désactiver soi-même, et on ne peut pas désactiver le dernier admin actif (l'API renvoie 400).

**Accès par école** : chaque utilisateur a une liste explicite d'écoles auxquelles il a accès (table `user_school_access`). La sidebar et toutes les API user-facing filtrent en conséquence : un commercial qui n'a accès qu'à EFAP ne voit que EFAP dans la sidebar et reçoit 403 s'il tente d'accéder à une autre école par URL directe.

**Statut :** ✅ livré (2026-05-01).

## Hébergement

- Une seule app, un seul container Docker, sur le VPS OVH derrière NPM.
- Sous-domaine `edh.messagingme.app` (DNS Cloudflare A record proxied).
- Déploiement par `git pull && docker compose up -d --build` sur le VPS.

**Statut :** ✅ livré.
