# CLAUDE.md — EDH Stats

Dashboard multi-écoles pour le client EDH. Trois fonctions :

1. **URLs trackées** pour templates WhatsApp — slug court → redirect 302 server-side, comptage des clics.
2. **Stats** — récupère les custom events via l'API messagingme et permet de comparer leur volumétrie aux clics URL (ratios).
3. **Base de connaissance** — alimente le vector store OpenAI de chaque école (4 modes : fichier PDF/TXT, saisie texte, Q/R structurées avec thèmes, import Excel en masse). Gère un vector store par école.

Header niveau 1 : `[Stats] [Base de connaissance]`. Sous-nav `[URLs] [Stats]` quand `Stats` est actif.

Déployé en Docker sur le VPS OVH `146.59.233.252` derrière NPM, sur le sous-domaine **`edh.messagingme.app`**.

## Documentation

- **`documentation.md`** — archi, stack, schéma DB, env vars, déploiement, patterns code
- **`features.md`** — vue produit : URLs + Stats + Base de connaissance côté utilisateur
- **`wip.md`** — travail en cours
- **`todo.md`** — backlog (RGPD, retention, export, cleanup orphans OpenAI, etc.)
- **`docs/plans/2026-04-30-edh-stats-design.md`** — design V1 (URLs + Stats)
- **`docs/plans/2026-04-30-edh-stats-implementation.md`** — plan V1 (10 phases TDD)
- **`docs/plans/2026-04-30-knowledge-base-design.md`** — design module Base de connaissance
- **`docs/plans/2026-04-30-knowledge-base-implementation.md`** — plan module Base de connaissance

## Commandes essentielles

```bash
npm run dev          # http://localhost:3000
npm run build        # production build (Next standalone)
npm run lint         # eslint
npm test             # vitest unit + API tests
npm run test:watch   # vitest watch mode
npm run seed:users   # seed DB (lit .env.local + SEED_*_PASSWORD env vars)
```

## Workflow Git — TOUJOURS sur main, jamais de worktree

**Le main worktree est `C:\Users\julie\EDH\` (Windows) / `/c/Users/julie/EDH` (bash).**

Si Claude Code démarre dans `.claude/worktrees/<name>/`, **NE PAS** y faire d'edits, builds, ou commits. **Tout doit se passer dans le main worktree.**

- Tout sur `main`, jamais de branche `claude/*`, jamais de worktree.
- Push direct sur `origin main` (https://github.com/julienmessagingme/edh).
- Chaque Bash call qui fait `npm`, `git`, ou touche le repo : `cd /c/Users/julie/EDH && ...`
- **Identité git pour les commits** (pas de config globale dans cet env) :
  ```bash
  git -c user.email="julien@messagingme.fr" -c user.name="Julien Dumas" commit -m "..."
  ```

## Déploiement

```bash
# en local
git push origin main

# sur le VPS (un-liner)
ssh -i ~/.ssh/id_ed25519 ubuntu@146.59.233.252 \
  "sudo bash -c 'cd /root/edh && git pull && docker compose up -d --build'"

# vérifier les logs
ssh -i ~/.ssh/id_ed25519 ubuntu@146.59.233.252 "sudo docker logs --tail 30 edh-app"
```

DNS : A record `edh` → `146.59.233.252` (Cloudflare proxied, cohérent avec `mieuxassure`).

NPM : proxy host id 12 `edh.messagingme.app` → `http://edh-app:3000`, SSL Let's Encrypt id 13 (renouvellement auto, expires 2026-07-29).

## Règles spécifiques au projet

- **Le slug d'une URL est immuable** une fois créé (template WhatsApp validé Meta) — modifier la destination crée une nouvelle version, le slug ne change jamais.
- **Migrations SQL appliquées à la main** via Supabase SQL Editor (pas de CLI push).
- **`/r/:slug` doit toujours marcher** même sans auth, même si la DB est partiellement down (503 propre, jamais 500 leak).
- **Cron 22:00 Europe/Paris** dans le process Next.js (sync messagingme séquentiel sur les 9 écoles, watermark `last_occurrence_id`). `DISABLE_CRON=1` pour le désactiver en dev.
- **9 écoles** : EFAP, 3WA, Brassart, CESINE, EFJ, ESEC, École Bleue, ICART, IFA. Bearer MessagingMe en env vars (`MM_TOKEN_<SLUG>`), vector store OpenAI en env vars (`OPENAI_VS_<SLUG>`), logos en `public/logos/<slug>.png`. Ajouter une école = mettre à jour la constante SCHOOLS + 2 env vars + déposer le logo + redeploy.
- **Base de connaissance** : OpenAI = source de vérité (vector store par école), Supabase = métadata. DELETE flow : best-effort cleanup OpenAI + DB delete inconditionnel (orphan files acceptés plutôt que ghost rows).
- **Pas de RLS Supabase.** L'app utilise le service-role server-side uniquement, jamais d'accès DB depuis le client.
- **UI 100% française** dans les strings affichées.

## État courant (2026-05-01)

**Prod live : https://edh.messagingme.app**

| Phase | État |
|-------|------|
| 0 — Scaffold Next.js 15 + Tailwind 4 + shadcn + Supabase + tests | ✅ |
| 1 — Schéma DB (migration 001) | ✅ appliqué |
| 2 — Auth (login/logout/middleware/seed) + code review | ✅ |
| 3 — SCHOOLS + sidebar + cookie + code review | ✅ |
| 4 — Redirect `/r/:slug` + rate-limit + code review | ✅ |
| 5 — Onglet URLs (CRUD + versioning) | ✅ |
| 6 — Client messagingme + cron + sync + code review | ✅ |
| 7 — Onglet Stats (accordéons + comparaison) + code review | ✅ |
| 8 — Dockerfile + docker-compose | ✅ |
| 9 — Déploiement VPS + NPM proxy + DNS + Let's Encrypt | ✅ |
| 10 — Module Base de connaissance (4 modes upload + thèmes + Excel SSE) + code review | ✅ |
| 11 — Rename EJF→EFJ (migration 003) + logos d'école / EDH groupe dans header + sidebar | ✅ |

Container `edh-app` sur réseau Docker `mcp-robot_default` (NPM), proxy host id 12, cert Let's Encrypt id 13 (expires 2026-07-29). Cron 22:00 Europe/Paris actif. 9 écoles avec leur logo, ~3k occurrences messagingme ingérées. 9 vector stores OpenAI configurés (un par école) pour la base de connaissance. Logos servis depuis `/public/logos/<slug>.png` + `/logos/edh.png` (groupe), middleware whitelist `/logos/`.
