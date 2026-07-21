# WIP — EDH Dashboard

> Travail en cours. Quand une entrée est livrée → la déplacer vers `features.md` ou supprimer.

## En cours

(rien — prod sur https://edh.messagingme.app)

## Fait récemment (depuis le dernier sync)

- **Réorganisation des stats par type de viz** (2026-07-17) : sous-nav `[Pie charts] [Funnel] [Global]`, création pie-only dans Pie charts, mini pie au hover d'une étape multi-sources, **comparaison de 2 périodes**, **onglet Global** (rapport texte + % de conversion + export PDF). Porté ensuite sur neoma et ganprev. Détail produit dans `features.md`.
- **Fix compteur Stats plafonné à 1000** : `/api/stats/custom-events` tronquait à 1000 (cap `max-rows` PostgREST) le count d'un event porteur **et son coût Meta**. Fix par pagination `.range()`, même pattern que la route dashboard `/data` (qui, elle, était déjà correcte). Corrigé aussi sur neoma et ganprev.

## ⚠️ Seed data temporaire TOUJOURS EN PLACE ? — échéance dépassée (annoncée 2026-05-22/23)

> ⚠️ Au 2026-07-17, aucun commit ni doc n'atteste du nettoyage : **à vérifier en base avant
> de se fier aux stats EDH**. Si le seed est encore là, les volumes de 4 écoles sont gonflés.
> Le SQL de cleanup est ci-dessous. Suivi dans `todo.md` (priorité).

Julien a demandé du fake data pour démos pendant 2-3 jours. Injecté le 2026-05-20 :

- **6713 occurrences fake** réparties sur 7 jours, 4 écoles (EFAP, Brassart, CESINE, ESEC), 4 events « CTWA EN: entrée campagne / Etape 1..4 ».
- **Marqueurs pour cleanup** :
  - Brassart/CESINE/ESEC : `mm_events.event_ns LIKE 'seed_%'` (les 4 events n'existaient pas naturellement → on les a créés)
  - EFAP : `mm_occurrences.id <= -1000000000` (les events existaient déjà → on a ajouté des occurrences avec id négatif sur les events réels)
- **Le cron 22h ne touche PAS au seed** (vérifié dans `src/lib/messagingme/sync.ts`) : pas de `DELETE` dans le code, watermark positif côté messagingme, ids seed négatifs → cohabitation propre.

**SQL de cleanup à passer dans Supabase SQL Editor** :

```sql
BEGIN;
-- Cascade FK ON DELETE CASCADE → supprime aussi les occurrences seed des 3 écoles
DELETE FROM mm_events
  WHERE school_slug IN ('brassart','cesine','esec')
    AND event_ns LIKE 'seed_%';
-- Restantes : les occurrences seed EFAP (events réels EFAP qu'on garde)
DELETE FROM mm_occurrences WHERE id <= -1000000000;
COMMIT;
-- Validation (les 2 doivent retourner 0)
SELECT count(*) FROM mm_occurrences WHERE id <= -1000000000;
SELECT count(*) FROM mm_events WHERE event_ns LIKE 'seed_%';
```

## À traiter dans la prochaine session

- **Cocher l'accès EDH** pour Laura et Sarah dans Admin une fois validé fonctionnellement par Julien.
- Surveiller la **perf des Stats EDH** : ~9 écoles × ~20 events = ~180 count() en parallèle sur Supabase. Si on voit des 503 / timeouts, refacto en une seule requête `GROUP BY (school_slug, event_ns)` côté Postgres.

## Notes opérationnelles à jour

### Container Docker

```bash
# SSH VPS
ssh -i ~/.ssh/id_ed25519 ubuntu@146.59.233.252

# Logs en temps réel
sudo docker logs -f edh-app

# Rebuild après git push
sudo bash -c 'cd /root/edh && git pull && docker compose up -d --build'

# Restart sans rebuild
sudo docker restart edh-app

# Status / réseaux
sudo docker ps --filter name=edh-app
sudo docker inspect edh-app --format '{{json .NetworkSettings.Networks}}' | jq
```

### Sync manuel en prod

```bash
# Toutes les écoles
curl -X POST -H "Authorization: Bearer $INTERNAL_API_KEY" https://edh.messagingme.app/api/cron/sync

# Une école seule
curl -X POST -H "Authorization: Bearer $INTERNAL_API_KEY" "https://edh.messagingme.app/api/cron/sync?school=efap"
```

Le INTERNAL_API_KEY est dans `/root/edh/.env` sur le VPS.

### NPM (Nginx Proxy Manager)

- Container : `mcp-robot_nginx-proxy-manager_1`
- Network : `mcp-robot_default` (joint par `edh-app` via docker-compose)
- Admin UI : http://127.0.0.1:81 (via SSH tunnel uniquement)
- Proxy host pour edh.messagingme.app : id 12
- Cert Let's Encrypt : id 13, renouvellement auto par NPM

Pour modifier le proxy host : admin UI NPM ou via API REST (cf. `documentation.md`
section déploiement pour la procédure JWT-via-keys.json).

### Cron

- Schedule : `0 22 * * *` Europe/Paris dans `src/instrumentation.ts`
- Actif si `DISABLE_CRON` ≠ "1"
- Sync séquentiel sur les 9 écoles via watermark (last_occurrence_id)
- Logs JSON dans `docker logs edh-app`

## Idées V2 (post-livraison)

Voir `todo.md` pour le backlog complet. Quelques pistes à creuser :

- Hash IP pour RGPD-strict (clicks.ip actuellement en clair).
- Retention `clicks` > 1 an + purge auto.
- Export CSV depuis l'onglet Stats.
- Geo-IP enrichment (`country` reste vide).
- Cleanup job des fichiers orphelins OpenAI (cas où `DELETE /items/:id`
  échoue côté OpenAI mais réussit côté DB → ghost OpenAI files).
- Optimiser Stats EDH en une seule requête `GROUP BY (school_slug, event_ns)`
  au lieu de N count() en parallèle (si problème de perf).

## Surveillance

À monitorer dans les 7 prochains jours :

- Le cron 22:00 doit tourner (vérifier `mm_sync_state.last_run_at` le matin) — ajouter une alerte ?
- Les compteurs de clics doivent grimper si EDH lance des campagnes WhatsApp.
- Pas d'erreur 5xx visible dans `docker logs edh-app | grep ERROR`.
- Cert Let's Encrypt : renouvellement auto NPM, mais surveiller à ~1 mois de l'expiration (juillet 2026).
