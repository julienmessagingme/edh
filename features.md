# Features — EDH Dashboard

> Vue produit, sans détail technique. Pour la doc tech : `documentation.md`.

## Authentification

- Login email + mot de passe.
- Comptes créés/désactivés par les administrateurs depuis l'onglet Admin (cf. plus bas). Au lancement : Julien, Kelberg, Hassani (admins) + utilisateurs invités côté EDH au fil de l'eau.
- Session 7 jours, cookie HttpOnly.
- Pas de self-service password change ni reset password V1 — l'admin réinitialise depuis le modal Modifier.

**Statut :** ✅ livré.

## Switch d'école (sidebar)

- Sidebar gauche fixe avec **uniquement les écoles auxquelles l'utilisateur a accès** (cf. Administration). Un user qui n'a accès qu'à EFAP ne verra que EFAP. Catalogue complet des 9 écoles : EFAP, 3WA, Brassart, CESINE, EFJ, ESEC, École Bleue, ICART, IFA.
- **Entrée « EDH groupe » en tête** (logo EDH + accent ambre) pour les utilisateurs qui ont l'accès EDH (cf. section dédiée). Sépare visuellement la vue agrégée toutes-écoles des écoles individuelles.
- Logo du groupe EDH en haut à gauche du header. Footer `Propulsé par <logo MessagingMe>` en bas de toutes les pages auth.
- Cliquer une école change le contexte de toute l'app — URLs, Stats, Mes tableaux et Base de connaissance se filtrent automatiquement. Cliquer « EDH groupe » bascule en mode agrégé (cf. ci-dessous).
- Le choix persiste 1 an dans un cookie. Si la school du cookie n'est plus accessible (admin a retiré l'accès), bascule auto sur la 1<sup>re</sup> école accessible (ou EDH si c'est le seul accès restant).
- Bouton « Se déconnecter » en bas de la sidebar.

**Statut :** ✅ livré.

## EDH groupe (vue agrégée toutes écoles)

Mode dédié à ceux qui pilotent toutes les écoles d'un coup (au lancement : Julien ; Laura/Sarah à activer via Admin). Sélectionnable depuis la sidebar quand l'utilisateur a l'accès EDH coché dans son profil admin.

En mode EDH :

- **Stats** affiche un accordéon par **(école, custom event)** et un par **(école, URL trackée)**, avec un chip « EFAP / 3WA / … » en préfixe pour qu'on ne mélange jamais deux events qui s'appelleraient pareil dans deux écoles différentes (par exemple `purchase_completed` qui peut exister chez EFAP et chez ICART pour des choses différentes).
- **Mes tableaux** propose une palette agrégée toutes écoles confondues (chaque item étiqueté avec son école) et permet de **cumuler dans une même étape des events de plusieurs écoles** — typiquement « Toutes les inscriptions JPO du groupe » qui somme `inscription_jpo` de chacune des 9 écoles.
- **Onglet « Base de connaissance » masqué** — il n'y a pas de KB groupe (chaque école a son propre vector store OpenAI). Pour alimenter une KB il faut basculer sur l'école concernée.
- **Sous-onglet « URLs » masqué** — la création d'URL trackée reste per-école (un slug = un template Meta validé pour une école donnée).
- L'admin reste utilisable normalement pour ceux qui sont admins.

L'accès EDH = lecture sur les **9 écoles**, indépendamment de l'ensemble d'écoles cochées par ailleurs. Concrètement : un user à qui on cocherait juste « EDH groupe » (sans aucune école) verrait quand même l'agrégat des 9 dans la sidebar EDH, sans pouvoir basculer sur une école individuelle.

**Statut :** ✅ livré (2026-05-08, migration 008).

## Onglets de niveau 1

Le header expose 2 ou 3 grands modes selon le rôle :

- **Stats** (par défaut) — URLs trackées + analytics MessagingMe + tableaux personnalisés + campagnes. Sous-nav : `[URLs] [Stats] [Mes tableaux] [Campagnes]`.
- **Base de connaissance** — alimente le vector store OpenAI de l'école courante (voir plus bas).
- **Admin** — visible **uniquement par les administrateurs**. Gestion des utilisateurs (voir plus bas).

Le contexte d'école (sidebar gauche) s'applique à tous ces modes.

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

- Sélecteur de période en haut : presets 7j / 30j / 90j + custom (deux date pickers). S'applique aux deux sections.
- **Section 1 — Custom events MessagingMe** : un accordéon par custom event de l'école courante. À l'ouverture, histogramme journalier bleu des occurrences en Europe/Paris.
- **Section 2 — Clics URL trackées** : un accordéon par URL non-archivée de l'école courante (avec son slug `/r/<slug>` en sous-titre). À l'ouverture, histogramme journalier vert des clics en Europe/Paris.
- Pas de comparaison directe entre les deux dans cet onglet — pour ça, utiliser **Mes tableaux** qui permet de mixer custom events et clics URL dans des funnels personnalisés.
- Bouton « ⟳ Re-sync » en bas pour relancer un sync manuel hors de 22:00.
- Affiche aussi la date du dernier sync MessagingMe et un compteur d'erreurs de sync si applicable.

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
- À gauche aussi, **filtre de palette** : un select en haut permet de basculer entre « Tout (palette complète) » et « Par campagne » → la palette n'affiche plus que les briques rattachées à la campagne choisie. Cf. section **Campagnes** plus bas.
- À droite, visualisation avec **toggle 2 modes** :
  - **Barres** (par défaut) : bar chart vertical recharts, hauteur = volume cumulé des sources de l'étape. Labels d'étapes en bas inclinés à -25° pour ne pas se chevaucher.
  - **Entonnoir** : funnel trapézoïdal reaviz purple+glow, conteneur light avec halo subtil. Pas de labels écrits dans l'entonnoir → tooltip premium au hover (étape + volume + conversion vs précédent + conversion vs étape 1).
  Le choix de mode est persisté en `localStorage` par navigateur.
- Sous le chart : table récap (étape, volume, conv. vs précédent, conv. vs étape 1, breakdown des sources individuelles si > 1).
- **Bouton Télécharger** : menu déroulant avec deux options :
  - **Excel (.xlsx)** : tableau seul (entêtes + lignes + sous-lignes pour les cumuls), avec metadata (nom du tableau, période, date d'export).
  - **PDF** : capture du chart actif (Barres ou Entonnoir selon ton choix de toggle) + tableau, en A4 paysage avec titre.
- Auto-save : chaque modif (renommage, ordre, étapes, sources, dates, label) est sauvegardée silencieusement après 500 ms (toast « Enregistrement… » discret en haut à droite).

**Étapes cumulées (rapports cumul)** : on peut empiler plusieurs sources dans une même étape — par exemple `relance benin V1` + `relance benin V2` + `relance ICART V1` formant l'étape `Relances`, dont le volume affiché = somme des trois. Mix mm + URL autorisé. Si une source disparaît, l'étape continue de fonctionner avec les sources restantes ; l'étape n'est marquée « indisponible » que si toutes ses sources ont disparu.

**Sémantique du funnel V1** : on compare des **volumes purs** d'occurrences sur la période. Pas de matching utilisateur entre étapes — c'est une vue esthétique pour repérer les ordres de grandeur et les ratios entre étapes consécutives, pas une analyse causale par utilisateur.

**Switch d'école** : la liste et le builder se rechargent automatiquement (pattern `key={schoolSlug}`). Si l'on est sur le builder d'un tableau qui appartient à une autre école que celle qui vient d'être sélectionnée, l'API renvoie 404 et on est redirigé vers `/dashboards` avec un toast.

**Statut :** ✅ livré.

## Campagnes

Quatrième sous-onglet de Stats (`[URLs] [Stats] [Mes tableaux] [Campagnes]`). Une campagne est un **regroupement nommé d'events MM et d'URLs trackées** rattaché à une école (ou au scope EDH groupe), avec **son propre tableau drag-and-drop** lié en 1:1. C'est l'unité de pilotage d'une opération marketing : on définit les briques qu'on veut suivre, puis on construit le funnel dans la foulée.

**Page liste `/campaigns`** :

- Grille de cards : nom de la campagne, badge `Partagée` (icône partage) ou `Privée` (icône cadenas), date de dernière modif.
- **Cliquer une card ouvre `/campaigns/[id]`** (l'éditeur drag-and-drop). Bouton poubelle pour supprimer (visible uniquement si l'utilisateur peut éditer la campagne).
- Bouton « + Nouvelle campagne » → modal de création.

**Modal de création** (premier passage uniquement) :

- Champ nom + checkbox « Partagée avec l'école ».
- Sélection optionnelle des briques (recherche + grille 2 colonnes : Custom events MM à gauche, Clics URL à droite, chip école en mode EDH). On peut laisser vide et les ajouter plus tard.
- Après création : redirection automatique vers `/campaigns/[id]` pour construire le tableau.

**Page éditeur `/campaigns/[id]`** :

- Encadré ambre en haut : nom et toggle Partagée/Privée éditables inline (auto-save 500 ms).
- En dessous, **le builder drag-and-drop identique à Mes tableaux** :
  - Palette à gauche **restreinte aux briques de la campagne** (mode strict, pas de select « Tout »).
  - Bouton « **Modifier les briques** » en haut de la palette → rouvre la modal de sélection des briques (la dialog de création). Après save, la palette du builder se met à jour automatiquement.
  - Zone d'étapes au centre, viz à droite (barres verticales ou entonnoir), export Excel/PDF, période presets/custom. Comme dans Mes tableaux.
- Bouton « ← Campagnes » dans le header pour revenir à la liste. Pas de bouton Supprimer ici (supprimer une campagne se fait depuis la liste, et emporte automatiquement le tableau via CASCADE).

**Lien 1:1 avec un tableau** : créer une campagne crée immédiatement un dashboard rattaché (table `dashboards.campaign_id`). Supprimer la campagne supprime le tableau (ON DELETE CASCADE). Les tableaux de campagne n'apparaissent **pas** dans Mes tableaux pour éviter le doublon : ils s'éditent uniquement via leur campagne.

**Visibilité** :

- Une campagne `Privée` n'est visible que par son auteur.
- Une campagne `Partagée` est visible par tous les utilisateurs ayant accès à l'école (ou à EDH groupe) — mais reste éditable et supprimable uniquement par son auteur (ou un administrateur). Les autres utilisateurs peuvent l'utiliser comme filtre de palette.
- Scope école strict : une campagne créée sur EFAP n'apparaît que pour les users qui ont EFAP comme école courante. Une campagne créée en mode EDH n'apparaît qu'en mode EDH (et peut mixer des briques des 9 écoles dans le même sac).

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

**Modal Inviter** : email + nom + mot de passe temporaire (auto-généré, copiable, régénérable à la volée) + grille des 9 écoles (toutes cochées par défaut, on décoche celles auxquelles on ne veut pas donner accès) + **10e checkbox « EDH groupe »** (séparateur, accent ambre, décochée par défaut) qui donne la vue agrégée toutes écoles + checkbox `Administrateur`. À la création, un toast affiche le mot de passe pendant 30 secondes pour qu'on puisse le copier-coller dans Slack/email vers la personne invitée.

**Modal Modifier** : email read-only (immuable), nom modifiable, champ optionnel "Nouveau mot de passe" (vide = inchangé), grille des écoles, checkbox admin.

**Désactivation (soft-delete)** : un user désactivé ne peut plus se logger (401 message générique au login), mais ses dashboards restent en DB pour audit. Réactivable à tout moment depuis la même page. On ne peut pas se désactiver soi-même, et on ne peut pas désactiver le dernier admin actif (l'API renvoie 400).

**Accès par école** : chaque utilisateur a une liste explicite d'écoles auxquelles il a accès (table `user_school_access`). La sidebar et toutes les API user-facing filtrent en conséquence : un commercial qui n'a accès qu'à EFAP ne voit que EFAP dans la sidebar et reçoit 403 s'il tente d'accéder à une autre école par URL directe.

**Statut :** ✅ livré (2026-05-01).

## Hébergement & branding

- Nom officiel de l'app : **EDH Dashboard** (titre `<title>` du navigateur, H1 du login).
- Une seule app, un seul container Docker, sur le VPS OVH derrière NPM.
- Sous-domaine `edh.messagingme.app` (DNS Cloudflare A record proxied).
- Déploiement par `git pull && docker compose up -d --build` sur le VPS.
- Footer `Propulsé par <logo MessagingMe>` rendu sur toutes les pages auth-gated.

**Statut :** ✅ livré.
