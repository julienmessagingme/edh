# TODO — EDH Stats

> Backlog : idées validées mais pas commencées, bugs connus, améliorations.

## Hors scope V1 (à considérer pour V2)

- **Hash IP RGPD-strict** : actuellement `clicks.ip` est en clair (outil interne). Si EDH veut être strict ou si on ouvre l'outil à plus de monde, hasher (HMAC avec rotation de salt mensuelle) ou tronquer le dernier octet.
- **Retention policy `clicks`** : purge des rows > 1 an. Job à ajouter au cron du soir.
- **Export CSV** : depuis l'onglet Stats, bouton « Export » qui télécharge la série journalière (ou les rows clicks brutes) sur la période sélectionnée.
- **Mobile** : tester sur mobile, ajuster la sidebar (drawer plutôt que fixed width).
- **Multi-tenant** : si d'autres clients que EDH demandent l'outil, ajouter une dimension `tenant` au-dessus de `school_slug`. Ne pas faire avant d'en avoir un vrai besoin.
- **Geo-IP enrichment** : `clicks.country` reste vide pour l'instant. Si besoin, utiliser une lib offline (`@maxmind/geoip2-node`) ou un service.
- **A/B testing destinations** : split traffic 50/50 entre 2 destinations sur le même slug.
- **Webhook side-channel sur clic** : notifier un autre service à chaque redirect (utile pour intégration CRM côté client).
- **DST-safe daily buckets** : actuellement Phase 7 va probablement utiliser un offset hardcodé `+02:00` pour Paris. Si on constate un bug à un changement d'heure (mars/octobre), refacto pour calculer l'offset par-jour via `date-fns-tz`.
- ~~**Dashboard "tous écoles confondues"**~~ — livré 2026-05-08 sous le nom **EDH groupe** (Phase 19). Cf. `features.md`.

## Mes tableaux — évolutions post-V1

- **Autres types de report** au-delà de `funnel` : graph temporel multi-events (lignes superposées), top-N par event, tableau de bord composite (plusieurs widgets sur une page). Étendre le `CHECK (type IN ('funnel'))` quand un nouveau type arrive.
- **Partage entre users** : flag `is_shared` sur `dashboards`, lecture-only pour les autres users de la même école, duplication via bouton « Dupliquer pour modifier ». Préserver `created_by` comme propriétaire édition.
- **Export CSV / PNG** du funnel (volumes + conversions, ou snapshot du chart).
- **Comparaison de périodes** : "30j courants vs 30j précédents" affiché en barres jumelées + delta %.
- **Embed / lien public** : un dashboard rendu en lecture seule sur une URL publique (avec rotation token). Surtout utile pour partager à un commercial qui n'a pas accès à l'outil.
- **Re-saisir le label d'une étape au moment où on l'ajoute** : aujourd'hui le label est lookuppé dynamiquement depuis la palette. Si l'event source disparaît, on perd le label. Stocker le label au moment de l'ajout dans `dashboard_steps.label_snapshot` permettrait d'afficher quelque chose de plus utile que `(indisponible)`.
- ~~**Doublon protection**~~ — livré (Phase 34) : une brique posée dans une étape disparaît de la palette (usage unique, UI seule). Cf. tableau d'état `CLAUDE.md`.
- **Plafond N étapes** : au-delà de ~12 étapes le chart devient illisible — pas urgent mais à surveiller.

## Bugs / quirks à signaler

- **Date filter messagingme** : l'API `/flow/custom-events/data` semble ignorer les paramètres `date_from` / `date_to` (testé pendant le brainstorming, retournait des données d'avril 2 même avec un filtre 20-30 avril). On contourne en stockant tout localement et filtrant côté Supabase. Si messagingme corrige, on peut potentiellement éviter l'ingest complet.
- **Nom des écoles** : 4 écoles ont un slug placeholder visuel propre (EFAP, ICART, etc.) mais pour `École Bleue` j'ai utilisé `ecole-bleue` (sans accent dans le slug). Si EDH veut un autre slug, modifier `SCHOOLS` dans `src/lib/schools.ts`.

## Tickets prioritaires

1. **Email du compte EDH** à demander à Julien avant Phase 2 seed prod.
2. **Confirmer le nom du réseau Docker NPM** sur le VPS avant Phase 8 docker-compose.
3. **Confirmer la propagation DNS** de `edh.messagingme.app` (A record vers 146.59.233.252) avant Phase 9 NPM proxy.

## Tickets non-prioritaires

- Ajouter Sentry ou un APM si on commence à voir des erreurs en prod silencieuses.
- Activer Cloudflare cache pour `/r/<slug>` ? Mauvaise idée probablement (on perdrait le comptage par clic). À étudier si la latence devient un problème.
- Page admin pour gérer les users (ajout/suppression) au lieu du seed script en CLI. Pas avant qu'on ait > 2 users.

## Dette technique Phase 20-21 (code-review 🟡)

Issues identifiées dans la revue de code du 2026-05-20, non bloquantes :

- **`RefSchema` zod dupliqué** entre `src/app/api/campaigns/route.ts` et `src/app/api/campaigns/[id]/route.ts` (même `discriminatedUnion("step_type", [...])` à l'identique). Extraire dans `src/lib/campaigns/schema.ts` quand on touchera à la validation des refs.
- **`campaign-editor-dialog.tsx` : `eslint-disable` sur `useMemo`** de `filteredMm` / `filteredUrls`. Le `filterItems` n'est pas dans les deps (utilise `search` en closure). Inliner le filtre directement dans le `useMemo` au lieu d'appeler `filterItems`, sans changer le comportement.
- **Race UI campagne fantôme** : si une campagne sélectionnée comme filtre dans `BuilderClient` est supprimée par un autre user pendant qu'on l'utilise (cas partagée), on tombe sur un toast "Erreur de chargement" + filtre vide silencieux. Cas rare ; à traiter si on voit le bug en prod.

## Coût Meta / pricing (Phase 32-33)

- **Caler les tarifs Meta sur la facture WABA réelle EDH** : `meta-pricing.ts` est rempli avec les tarifs *officiels publiés* Meta (outil whatsappbusiness.com, EUR, Marketing + Utility), mais la facture réelle peut différer (paliers de volume, termes du compte). Comparer dès qu'une facture est dispo et ajuster.
- **Vérifier le classement régional Maghreb / Réunion** : Maroc/Algérie/Tunisie sont mis en tier « Reste de l'Afrique » (0,0186) et Réunion en tarif France — c'est une inférence (Meta ne les liste pas individuellement). À confirmer (Algérie surtout : 0,105 → 0,0186, gros écart).
- **Brancher `utilityEur` dans l'UI de coût** le jour où EDH enverra des messages *utility* : aujourd'hui `utilityEur` est stocké par pays (référence) mais le calcul de coût n'utilise que `marketingEur`. Il faudra un sélecteur de catégorie (Marketing/Utility) côté funnel.
- **(option) test `extractCountry`** : quelques numéros représentatifs → pays/tarif attendu, pour garder un garde-fou contre une édition accidentelle de la table.

## Parc dashboards — alignement (port)

- **neoma / ganprev** : ont reçu le pricing officiel + le fix scroll + les 2 features builder (usage unique, renommage d'étape découvrable), mais PAS le multi-launch (Phase 29), le multi-failed (Phase 31) ni le renommage des steps synthétiques (Phase 35) — elles sont à un stade campagne antérieur (single launch/failed). À remonter au niveau EDH si le besoin se présente.
- **odalys** a son propre module Campagnes + coût Meta par indicatif (code Node séparé, pas un clone EDH) : aligner ses tarifs sur les tarifs officiels Meta si pertinent (même technique de récupération, cf. `brain/LEARNINGS.md`).
