# WIP — EDH Stats

> Travail en cours. Quand une entrée est livrée → la déplacer vers `features.md` ou supprimer.

## En cours

(rien — V1 + module Base de connaissance livrés en prod sur https://edh.messagingme.app)

## À traiter dans la prochaine session

(rien d'urgent — les 2 items différés ont été livrés le 2026-05-01 :
rename ejf→efj + logos école/EDH dans sidebar et header).

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
- Dashboard agrégé "toutes écoles confondues".
- Geo-IP enrichment (`country` reste vide).
- Cleanup job des fichiers orphelins OpenAI (cas où `DELETE /items/:id`
  échoue côté OpenAI mais réussit côté DB → ghost OpenAI files).

## Surveillance

À monitorer dans les 7 prochains jours :

- Le cron 22:00 doit tourner (vérifier `mm_sync_state.last_run_at` le matin) — ajouter une alerte ?
- Les compteurs de clics doivent grimper si EDH lance des campagnes WhatsApp.
- Pas d'erreur 5xx visible dans `docker logs edh-app | grep ERROR`.
- Cert Let's Encrypt : renouvellement auto NPM, mais surveiller à ~1 mois de l'expiration (juillet 2026).
