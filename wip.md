# WIP — EDH Stats

> Travail en cours. Quand une entrée est livrée → la déplacer vers `features.md` ou supprimer.

## En cours

(rien actuellement — on est en pause après Phase 4 pour la checkpoint utilisateur)

## Phase 5 — Onglet URLs (CRUD events + versions)

À implémenter :

- `POST /api/events` : crée un event + version v1, génère slug nanoid, retry sur collision (rare).
- `GET /api/events` : liste les events de l'école courante (non archivés) + version active + count clics + dernier clic.
- `POST /api/events/:id/versions` : ferme la version courante (`active_to=now()`), crée v+1.
- `PATCH /api/events/:id` : rename.
- `DELETE /api/events/:id` : archive (soft delete).
- UI `/urls` : page server + client (`UrlsClient`), modal "Nouvel événement", modal "Modifier la destination", menu `⋯` (renommer / archiver / historique versions).
- Validation zod stricte de `destination_url` (http/https only, pas de `javascript:`).
- **Important** : à chaque mutation (create, new version, archive, rename), appeler `invalidateSlugCache(slug)` sinon le redirect `/r/:slug` peut servir une vieille destination pendant 60s.
- Tests : create + version + rename + archive, refus URL invalide, refus event d'une autre école.

## Phase 6 — Cron + sync messagingme

À implémenter :

- `src/lib/messagingme/client.ts` : `listEvents` (paginé) + `iterOccurrences` (async generator) avec retry x2 sur 5xx/timeout.
- `src/lib/messagingme/sync.ts` : `syncSchool(school, token)` + `syncAllSchools()` (séquentiel, try/catch par école).
  - Refresh `mm_events` (upsert).
  - Pour chaque event : lire watermark `mm_sync_state.last_occurrence_id`, paginer `/data` du plus récent au plus ancien, stop dès `id <= watermark`, insert les nouveaux, update watermark.
- `src/instrumentation.ts` : bootstrap `node-cron` `0 22 * * *` Europe/Paris au démarrage du process Node. Câbler aussi `warnMissingSchoolTokens()` pour log au boot.
- `POST /api/cron/sync` : Bearer auth `INTERNAL_API_KEY`, lance `syncAllSchools()` (ou une seule école via `?school=<slug>`).
- `POST /api/admin/sync` : variante auth-gated par session (pour le bouton ⟳ depuis l'UI Stats — évite d'exposer `INTERNAL_API_KEY` côté client).
- Tests : sync s'arrête correctement au watermark, retry fonctionne, fail isolé n'interrompt pas les autres écoles.

## Phase 7 — Onglet Stats (accordéons + comparaison)

À implémenter :

- `src/lib/stats/daily.ts` : `getCustomEventDaily` + `getClicksDaily` qui agrègent en buckets journaliers Europe/Paris.
- `GET /api/stats/custom-events?from=&to=` : liste des `mm_events` de l'école avec count sur la période + état du sync.
- `GET /api/stats/custom-events/:event_ns/daily?from=&to=` : série journalière.
- `GET /api/stats/clicks/:event_id/daily?from=&to=` : série journalière.
- UI `/stats` : page + `StatsClient` + `EventAccordion`. Date pickers, presets 7j/30j/90j. BarChart 2 séries quand URL sélectionnée + LineChart taux quotidien.
- Edge case : ratio quand `occurrences=0 & clicks>0` → afficher `—` (pas Infinity).
- DST simplification : timezone offset hardcodé `+02:00` actuellement. Si bug constaté à un changement d'heure, refacto pour offset par-jour.

## Phase 8 — Dockerfile + docker-compose

À implémenter :

- `.dockerignore` (exclut `node_modules`, `.next`, `.git`, `.env*`, `docs/`, `supabase/`, `tests/`).
- `Dockerfile` multi-stage : `node:22-alpine` deps → builder → runner (user nextjs uid 1001), `CMD ["node", "server.js"]`.
- `docker-compose.yml` : service `edh-app`, `env_file: .env`, expose 3000, `networks: [npm]` (external).
- Identifier le nom exact du réseau Docker NPM existant sur le VPS (probablement `mcp-robot_default`) → mettre dans le compose.
- Build local `docker build -t edh-app:local .` + smoke `docker run --rm -p 3001:3000 ...`.

## Phase 9 — Déploiement VPS

À faire (avec Julien, étape par étape) :

1. SSH VPS, `mkdir /root/edh && git clone https://github.com/julienmessagingme/edh.git`.
2. Créer `/root/edh/.env` avec les vraies valeurs prod (PUBLIC_BASE_URL=https://edh.messagingme.app, tous les MM_TOKEN_*).
3. `sudo docker compose up -d --build`.
4. `sudo docker logs --tail 50 edh-app` → vérifier Next.js ready + cron scheduled.
5. NPM admin UI : ajouter proxy host `edh.messagingme.app` → `http://edh-app:3000`, SSL Let's Encrypt.
6. Vérifier `curl -I https://edh.messagingme.app/login` → 200.
7. Trigger manuel `POST /api/cron/sync` avec Bearer prod → vérifier `SELECT count(*) FROM mm_occurrences GROUP BY school_slug` dans Supabase.
8. Smoke test redirect : créer un URL, copier, ouvrir en incognito, vérifier `SELECT * FROM clicks ORDER BY clicked_at DESC LIMIT 5`.

## Bloquants connus

- **Email du compte EDH non fourni** — le seed Phase 2 a un placeholder. À fournir avant le seed prod.
- **Migration 001 non appliquée** — à faire dans Supabase SQL Editor avant tout test end-to-end. L'app build et tourne mais toute query DB échouera.
- **Configuration NPM** non vérifiée — le nom du réseau Docker doit être confirmé sur le VPS.

## Code reviews à venir

- Review Phase 5 (CRUD URLs) : focus sur la validation URL + l'invalidation cache.
- Review Phase 6 (cron + sync) : focus sur l'idempotence et les fail modes.
- Review Phase 7 (Stats) : focus sur les agrégations DST-safe + l'auth des endpoints stats.
- Review finale Phase 8-9 : Dockerfile sécurité (pas de root, secrets pas dans l'image, .dockerignore complet).
