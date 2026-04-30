# CLAUDE.md — EDH Stats

Dashboard multi-écoles pour le client EDH. Deux fonctions :

1. **URLs trackées** pour templates WhatsApp — slug court → redirect 302 server-side, comptage des clics.
2. **Stats** — récupère les custom events via l'API messagingme et permet de comparer leur volumétrie aux clics URL (ratios).

Déployé en Docker sur le VPS OVH `146.59.233.252` derrière NPM, sur le sous-domaine **`edh.messagingme.app`**.

## Documentation

- **`documentation.md`** — archi, stack, schéma DB, env vars, déploiement, patterns code
- **`features.md`** — vue produit : URLs + Stats côté utilisateur
- **`wip.md`** — travail en cours (Phase 5+ pas encore livrée)
- **`todo.md`** — backlog (RGPD, retention, export, etc.)
- **`docs/plans/2026-04-30-edh-stats-design.md`** — design doc validé en brainstorming
- **`docs/plans/2026-04-30-edh-stats-implementation.md`** — plan d'implémentation phase par phase (10 phases, TDD)

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

## Déploiement (Phase 9 — non encore exécutée)

```bash
# en local
git push origin main

# sur le VPS
ssh -i ~/.ssh/id_ed25519 ubuntu@146.59.233.252
cd /root/edh && git pull && sudo docker compose up -d --build
sudo docker logs -f edh-app
```

DNS : A record `edh` → `146.59.233.252` (Cloudflare proxied, cohérent avec `mieuxassure`).

NPM : proxy host `edh.messagingme.app` → `http://edh-app:3000`, SSL Let's Encrypt.

## Règles spécifiques au projet

- **Le slug d'une URL est immuable** une fois créé (template WhatsApp validé Meta) — modifier la destination crée une nouvelle version, le slug ne change jamais.
- **Migrations SQL appliquées à la main** via Supabase SQL Editor (pas de CLI push).
- **`/r/:slug` doit toujours marcher** même sans auth, même si la DB est partiellement down (503 propre, jamais 500 leak).
- **Cron 22:00 Europe/Paris** (Phase 6) tournera dans le process Next.js. `DISABLE_CRON=1` pour le désactiver en dev.
- **9 écoles** : EFAP, 3WA, Brassart, CESINE, EJF, ESEC, École Bleue, ICART, IFA. Bearer tokens en env vars (`MM_TOKEN_<SLUG>`). Ajouter une école = redeploy.
- **Pas de RLS Supabase.** L'app utilise le service-role server-side uniquement, jamais d'accès DB depuis le client.
- **UI 100% française** dans les strings affichées.

## État courant (2026-04-30)

| Phase | État |
|-------|------|
| 0 — Scaffold Next.js 15 + Tailwind 4 + shadcn + Supabase + tests | ✅ |
| 1 — Schéma DB (migration 001) | ✅ écrit, ⚠️ **à appliquer** dans Supabase SQL Editor |
| 2 — Auth (login/logout/middleware/seed) + code review | ✅ |
| 3 — SCHOOLS + sidebar + cookie + code review | ✅ |
| 4 — Redirect `/r/:slug` + rate-limit + code review | ✅ |
| 5 — Onglet URLs (CRUD + versioning) | ⏳ pas commencée |
| 6 — Client messagingme + cron + sync | ⏳ |
| 7 — Onglet Stats (accordéons + comparaison) | ⏳ |
| 8 — Dockerfile + docker-compose | ⏳ |
| 9 — Déploiement VPS + NPM proxy + DNS | ⏳ |

Voir `wip.md` pour les détails de ce qui reste.
