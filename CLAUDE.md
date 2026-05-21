# CLAUDE.md — EDH Dashboard

Dashboard multi-écoles pour le client EDH. Six fonctions :

1. **URLs trackées** pour templates WhatsApp — slug court → redirect 302 server-side, comptage des clics.
2. **Stats** — deux sections séparées : (a) volumétrie journalière de chaque custom event mm, (b) volumétrie journalière des clics par URL trackée. Filtre période commun. En mode **EDH groupe** (cf. ci-dessous), un accordéon par (école, event) et par (école, URL) avec chip école en préfixe.
3. **Mes tableaux** — chaque user UI construit ses propres tableaux par école. À la création, choix entre **funnel** (étapes ordonnées, viz bar chart vertical ou entonnoir reaviz) et **pie chart** (parts du gâteau, base 100). Chaque étape/part peut **cumuler** plusieurs events (mm + URL mixés), volumes sommés. Drag-and-drop palette → étape (nouvelle ou existante), label éditable. Persistés en DB et privés. La palette peut être filtrée par campagne (cf. ci-dessous). En mode EDH, le cumul peut mixer des events de plusieurs écoles dans la même étape.
4. **Campagnes** — chaque user UI peut créer des **campagnes** (regroupements nommés de plusieurs events mm + URLs trackées), privées ou partagées avec l'école. Chaque campagne possède **son propre tableau drag-and-drop** (1:1, table `dashboards.campaign_id`) édité sur `/campaigns/[id]` avec la palette restreinte aux briques de la campagne. Les tableaux de campagne ne s'affichent PAS dans Mes tableaux pour éviter le doublon. Scope école strict (ou scope EDH groupe).
5. **Base de connaissance** — alimente le vector store OpenAI de chaque école (4 modes : fichier PDF/TXT, saisie texte, Q/R structurées avec thèmes, import Excel en masse). Gère un vector store par école. **Pas disponible en mode EDH** (pas de KB groupe, chaque école a son vector store).
6. **Admin** — onglet visible uniquement par les admins (Julien, Kelberg, Hassani au moment de l'écriture). Permet d'inviter de nouveaux utilisateurs, de cocher leurs écoles d'accès **et l'accès EDH groupe** (10e checkbox), et de désactiver les comptes. Les non-admins ne voient ni le tab ni l'URL `/admin`.

**Sidebar** : entrée « EDH groupe » accent ambre en tête, au-dessus des 9 écoles, conditionnelle à l'accès EDH (`user_school_access.school_slug = 'edh'`). Au lancement EDH ouvert à Julien (Laura/Sarah à activer via Admin).

Header niveau 1 : `[Stats] [Base de connaissance] [Admin]` (le 3e onglet visible uniquement aux admins ; **« Base de connaissance » masquée en mode EDH**). Sous-nav `[URLs] [Stats] [Mes tableaux] [Campagnes]` quand `Stats` est actif (**« URLs » masqué en mode EDH** — création de slug per-école par nature).

Déployé en Docker sur le VPS OVH `146.59.233.252` derrière NPM, sur le sous-domaine **`edh.messagingme.app`**.

## Documentation

- **`documentation.md`** — archi, stack, schéma DB, env vars, déploiement, patterns code
- **`features.md`** — vue produit : URLs + Stats + Mes tableaux + Campagnes + Base de connaissance + Admin côté utilisateur
- **`wip.md`** — travail en cours
- **`todo.md`** — backlog (RGPD, retention, export, cleanup orphans OpenAI, etc.)
- **`docs/plans/2026-04-30-edh-stats-design.md`** — design V1 (URLs + Stats)
- **`docs/plans/2026-04-30-edh-stats-implementation.md`** — plan V1 (10 phases TDD)
- **`docs/plans/2026-04-30-knowledge-base-design.md`** — design module Base de connaissance
- **`docs/plans/2026-04-30-knowledge-base-implementation.md`** — plan module Base de connaissance
- **`docs/plans/2026-05-01-dashboards-design.md`** — design module Mes tableaux
- **`docs/plans/2026-05-01-dashboards-implementation.md`** — plan module Mes tableaux
- **`docs/plans/2026-05-01-dashboards-cumul-implementation.md`** — plan extension cumul (multi-refs par step)
- **`docs/plans/2026-05-01-admin-design.md`** — design module Admin (is_admin + user_school_access)
- **`docs/plans/2026-05-01-admin-implementation.md`** — plan module Admin

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
- **Export PDF : `html-to-image`, pas `html2canvas`.** Tailwind v4 émet des couleurs en `oklch()` que `html2canvas` ne sait pas parser → canvas vide. `html-to-image` les supporte. `jspdf` + `html-to-image` sont chargés en dynamic import (`import()`) dans `src/lib/dashboards/export.ts` pour ne pas alourdir le bundle initial.
- **Scope EDH groupe** : sentinelle `'edh'` distincte des 9 écoles. Stockée en row `user_school_access (user_id, 'edh')` pour matérialiser l'accès, en valeur de cookie `edh_school='edh'` pour matérialiser le scope courant, et en valeur de `dashboards.school_slug='edh'` pour les funnels EDH. `isValidSchoolSlug` reste strict (rejette 'edh') ; `isValidScopeSlug` accepte les deux. Avoir l'accès EDH = pouvoir lire les events des **9 écoles** quel que soit l'ensemble d'écoles cochées par ailleurs.
- **`event_school_slug` dans `dashboard_step_refs`** : NULL en mode école-précise (legacy), renseigné en mode EDH (car `event_ns` n'est pas globalement unique entre écoles). Contrainte CHECK : doit être NULL pour `step_type='url_click'` (redirect_event_id est déjà un uuid global).

## État courant (2026-05-08)

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
| 12 — Module Mes tableaux (custom dashboards funnel + dnd-kit + recharts) | ✅ |
| 13 — Mes tableaux : étapes cumulées (multi-refs par step, migration 005, label éditable) | ✅ |
| 14 — Module Admin (is_admin + user_school_access + invite/désactivation, migration 006) | ✅ |
| 15 — Mes tableaux : toggle viz Barres / Entonnoir (reaviz purple+glow + tooltip custom) | ✅ |
| 16 — Mes tableaux : export Excel (xlsx) + PDF (chart + tableau, html-to-image + jspdf) | ✅ |
| 17 — Stats refactor : suppression comparaison URL dans accordéons custom events + nouvelle section "Clics URL trackées" séparée | ✅ |
| 18 — Rename EDH Stats → EDH Dashboard + footer logo MessagingMe (`/logos/messagingme.png`) | ✅ |
| 19 — Scope EDH groupe (sidebar entry, Stats agrégées per (école, event), Mes tableaux multi-écoles, migration 008 `event_school_slug`) | ✅ |
| 20 — Bar chart vertical + module Campagnes (tables `campaigns` + `campaign_refs`, migration 009, privé/partagé, filtre palette dans Mes tableaux) | ✅ |
| 21 — Campagne ↔ Tableau lié 1:1 (migration 010 `dashboards.campaign_id`, page `/campaigns/[id]` = builder drag-and-drop, palette strict, route `ensure-dashboard` pour migration douce) | ✅ |
| 22 — Pie chart en plus du funnel (migration 011 `type IN ('funnel','pie')`, radio à la création dans **Mes tableaux uniquement** — les campagnes restent forcément funnel, recharts PieChart + PieTable base 100, export Excel adapté) | ✅ |

Container `edh-app` sur réseau Docker `mcp-robot_default` (NPM), proxy host id 12, cert Let's Encrypt id 13 (expires 2026-07-29). Cron 22:00 Europe/Paris actif. 9 écoles avec leur logo, ~3k occurrences messagingme ingérées. 9 vector stores OpenAI configurés (un par école) pour la base de connaissance. Logos servis depuis `/public/logos/<slug>.png` + `/logos/edh.png` (groupe) + `/logos/messagingme.png` (footer "Propulsé par"), middleware whitelist `/logos/`. Module Mes tableaux : tables `dashboards` + `dashboard_steps` + `dashboard_step_refs` (multi-refs par step pour cumul de volumes, `event_school_slug` pour le mode EDH), auto-save 500ms via RPC PL/pgSQL `replace_dashboard_steps` (atomique, transaction Postgres). Libs charts/UI : `@dnd-kit/core`+`@dnd-kit/sortable` (drag-and-drop), `recharts` (bar chart) + `reaviz` (funnel trapézoïdal), `xlsx` + `jspdf` + `html-to-image` (export Excel/PDF, dynamic import). Scope EDH : sentinelle `'edh'` dans `user_school_access` + cookie `edh_school` + `dashboards.school_slug` ; chip école « EFAP / 3WA / … » en préfixe partout (palette, step refs, accordéons stats).
