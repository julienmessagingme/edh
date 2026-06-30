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
- **Sync MM = curseur ASCENDANT.** `GET /flow/custom-events/data` renvoie les occurrences par `id` croissant (plus ancien d'abord). `iterOccurrences` pagine via `start_id` (curseur **exclusif** : `id > start_id`, donc on passe le watermark **tel quel**, jamais `+1`) + `limit=100` (cap dur, `500` → HTTP 422). Le watermark avance au **max id réellement inséré**, jamais sur un `meta.total`. Upsert **idempotent** (`resolution=ignore-duplicates`, PK `(school_slug, id)`). **JAMAIS de break précoce sur la page 1** : c'était le bug historique (chaque event gelé après le backfill initial car la page 1 ne contient que des `id ≤ watermark`). Repair = remettre les watermarks à 0 + resync (l'upsert idempotent comble les trous sans doublon).
- **Sync append-only.** On n'efface jamais d'occurrence. Si MM retire des occurrences ou archive un event de son catalogue, la base les **garde** (historique préservé) → léger surcompte assumé vs le live MM. Les events archivés restent dans `mm_events` et continuent de s'afficher. Signature des **fausses données** de démo : `id < 0` (les vrais ids MM sont positifs) → cleanup `DELETE WHERE id < 0`.
- **9 écoles** : EFAP, 3WA, Brassart, CESINE, EFJ, ESEC, École Bleue, ICART, IFA. Bearer MessagingMe en env vars (`MM_TOKEN_<SLUG>`), vector store OpenAI en env vars (`OPENAI_VS_<SLUG>`), logos en `public/logos/<slug>.png`. Ajouter une école = mettre à jour la constante SCHOOLS + 2 env vars + déposer le logo + redeploy.
- **Base de connaissance** : OpenAI = source de vérité (vector store par école), Supabase = métadata. DELETE flow : best-effort cleanup OpenAI + DB delete inconditionnel (orphan files acceptés plutôt que ghost rows). Les 9 écoles ont été **préchargées avec le même lot de FAQ** (~34 Q&R chacune). Vector store (`OPENAI_VS_<SLUG>` distincts vérifiés) **et** dedup Q&R (`findQaDuplicate`, `qa-shared.ts`) strictement **per-école** : un « existe déjà pour cette école » est **normal** si la FAQ commune y est déjà — ce n'est PAS une fuite entre écoles (3WA ne partage pas le store d'EFAP).
- **Pas de RLS Supabase.** L'app utilise le service-role server-side uniquement, jamais d'accès DB depuis le client.
- **UI 100% française** dans les strings affichées.
- **Export PDF : `html-to-image`, pas `html2canvas`.** Tailwind v4 émet des couleurs en `oklch()` que `html2canvas` ne sait pas parser → canvas vide. `html-to-image` les supporte. `jspdf` + `html-to-image` sont chargés en dynamic import (`import()`) dans `src/lib/dashboards/export.ts` pour ne pas alourdir le bundle initial.
- **Scope EDH groupe** : sentinelle `'edh'` distincte des 9 écoles. Stockée en row `user_school_access (user_id, 'edh')` pour matérialiser l'accès, en valeur de cookie `edh_school='edh'` pour matérialiser le scope courant, et en valeur de `dashboards.school_slug='edh'` pour les funnels EDH. `isValidSchoolSlug` reste strict (rejette 'edh') ; `isValidScopeSlug` accepte les deux. Avoir l'accès EDH = pouvoir lire les events des **9 écoles** quel que soit l'ensemble d'écoles cochées par ailleurs.
- **`event_school_slug` dans `dashboard_step_refs`** : NULL en mode école-précise (legacy), renseigné en mode EDH (car `event_ns` n'est pas globalement unique entre écoles). Contrainte CHECK : doit être NULL pour `step_type='url_click'` (redirect_event_id est déjà un uuid global).
- **Tableau d'une campagne hérite de l'ACL de la CAMPAGNE** (`campaigns.created_by`/`is_shared`), JAMAIS de `dashboards.is_shared`. Enforced dans `loadAccessible` de `/api/dashboards/[id]` ET la visibilité de `.../data` : si `campaign_id` non null → résoudre la campagne (client **raw** → **vérifier `camp.school_slug === scope`**, multi-école). NE JAMAIS utiliser `campaign_id !== null` comme garde-fou : ça fuit les compteurs d'une campagne privée à toute l'école ET passe faux-visible sur un `undefined` (cassait les tests 404-not-owned). Builder en lecture seule quand `dashboard.can_edit===false`. (migration 013 ; corrigé 2026-06-15.)
- **Tests dashboards = client RAW `getSupabase`** (pas de `getSupabaseScoped`, ≠ neoma/ganprev). `loadAccessible` lit `users.is_admin` une fois la visibilité validée → tout mock par-table custom doit fournir la table `users` (sinon « Unexpected table: users »). Les tests de visibilité de campagne mockent `campaigns` avec `school_slug` (le check multi-école). Slugs de test = écoles réelles (`efap`, `icart`…), jamais collapsés en single-school.

## État courant (2026-06-29)

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
| 23 — Coût Meta WhatsApp marketing dans les funnels (lib `meta-pricing.ts` 50 pays, calcul à la volée par event porteur, colonne table + filtre palette pie) | ✅ |
| 24 — Coût Meta cliquable + détail par pays (modale `MetaCostBreakdownDialog`, button `MetaCostButton` partagé Stats + funnel) | ✅ |
| 25 — Campagnes structurées en 3 rôles (`launch` / `body` / `failed`, migration 012, dialog 3 sections, palette body-only, encadré Synthèse coût net dans le builder) | ✅ |
| 26 — Tableaux Mes tableaux partageables (`dashboards.is_shared`, migration 013, badge sur les cards, toggle dans le header du builder, lecture seule si non-owner) | ✅ |
| 27 — Fix bug pagination sync MM (curseur ascendant `start_id` exclusif, suppression du break précoce, upsert idempotent) + backfill réparateur (~15k occ.) + purge 6713 fausses occurrences (`id<0`) + réconciliation exacte live-vs-DB | ✅ |
| 28 — Bundle remonté de Neoma : dialog campagnes large + filtre Meta bots IP/Referer (UA spoofé depuis 2024) + logs JSON `/r/[slug]` + fix PDF overflow nested + funnel campagne enrichi (synth launch/failed steps dans la table+chart, barre Lancement stackée net+failed rouge, conv% Échec vs Lancement, encadré Coût net Meta XL, tableau aligné net au lieu de brut) | ✅ |
| 29 — Campagnes : plusieurs **events de lancement** cumulés (migration 014 drop index unique `campaign_refs_one_launch`, `failed` reste unique ; dialog section 1 en multi-sélection carriers tel ; step synthétique « Lancement » = cumul de tous les launch refs avec breakdown pays fusionné ; synthèse coût net réutilise `computeRef` ; `CampaignCostSummary.launch.events[]` ; builder inline éditable si ≤1 event, chips read-only si ≥2) | ✅ |
| 30 — Fixes post-29 : libellés d'axe X du funnel en **retour à la ligne** (mode `wrap` sur `BarXAxis`, anti-chevauchement, hérité par l'export PDF) ; **tableau d'une campagne partagée accessible aux non-owners** (`loadAccessible` GET `/api/dashboards/[id]` accepte `campaign_id !== null` comme `/data` ; read-only si non-owner : `persist` no-op + champs nom/période désactivés + indicateur « Lecture seule ») ; tarif Meta France 0.0791 → 0.0715 €/msg ; cap count/coût event porteur plafonné à 1000 + fix palette pie amputée | ✅ |
| 31 — Campagnes : plusieurs **events failed** cumulés (migration 015 drop index unique `campaign_refs_one_failed` ; symétrique du multi-launch Phase 29 ; route data `failedRefCfgs` filter → 1 step synthétique « Échec » cumulant tous les failed, `failedCount` = somme déduite du net ; `CampaignCostSummary.failed → { count, label, events[] }` ; dialog section 3 en multi-sélection, suppression `EventSelect` ; builder `LaunchInline` généralisé en `RoleEventsInline` réutilisé launch+failed) | ✅ |
| 32 — Coût Meta : table `meta-pricing.ts` entièrement **réalignée sur les tarifs officiels Meta** (outil whatsappbusiness.com, endpoint `wp-json/wab/v1/pricing` market/currency=EUR/category=Marketing + nonce, récupéré 2026-06-30) — diagnostic initial : 38 % des numéros d'un gros event EFAP en « Autre », dont 89 % Madagascar (+261, absent). Couverture 50 → 115 indicatifs via les tiers régionaux Meta (AFR 0,0186 / WEU 0,049 / CEEU 0,0712 / MDE 0,0282 / APAC 0,0606 / NAM 0,0207 / Autre 0,05) ; correction des valeurs périmées y compris EU (Allemagne 0,079→0,113, Pays-Bas 0,082→0,132, Égypte 0,0997→0,0533, Afrique subsah.→0,0186). « Autre » 38 % → 0,4 % (reste = numéros réellement malformés +215). Re-vérifier ~2×/an (Meta révise) sur le même outil | ✅ |
| 33 — Coût Meta : ajout des tarifs **Utility** par pays (`utilityEur` sur `PhoneCountry`, récupérés sur le même endpoint Meta `category=Utility` — référence pour les futurs envois utility ; pas encore branché dans l'UI de coût, qui reste Marketing) + **fix scroll** de la modale `MetaCostBreakdownDialog` (la liste 115 pays débordait sans scroll : `max-h-[85vh]` + `flex-col`, liste pays scrollable, en-tête de colonnes collant, total + note figés en pied) | ✅ |
| 34 — Builder (Mes tableaux + Campagnes) : (a) une brique **disparaît de la palette une fois posée** dans une étape (usage unique ; `usedRefIds` recalculé à chaque rendu depuis `dashboard.steps` → réapparaît si on la retire ; filtre appliqué à `displayedPalette`, donc aussi au menu « + Ajouter » d'une étape) ; (b) **renommage d'étape rendu découvrable** : `stepDisplayLabel` (placeholder du champ nom) affiche « Cumul de N sources » pour ≥2 sources, identique au tableau (`compactStepLabel`), + tooltip — pour qu'on voie que c'est là qu'on renomme. Le champ nom d'étape existait déjà ; seul le placeholder était trompeur (montrait « A + B + C ») | ✅ |
| 35 — Campagnes : **renommage des steps synthétiques Lancement / Échec** (migration 016 `campaigns.launch_label` + `failed_label`, nullable = nom auto). `SynthStepLabelField` (champ nom au-dessus des chips Lancement/Échec dans le builder, save on blur via PATCH campagne) ; le step synth utilise le label custom dans table + chart (`launchStep.label`/`failedStep.label`) ; `CampaignCostSummary.launch/failed.custom_label`. Fetch **gracieux** dans la route data : colonne absente → `null` → label auto, pas de crash si migration pas encore appliquée. DB partagée EDH/neoma/ganprev → migration 016 une seule fois | ✅ |

Container `edh-app` sur réseau Docker `mcp-robot_default` (NPM), proxy host id 12, cert Let's Encrypt id 13 (expires 2026-07-29). Cron 22:00 Europe/Paris actif. 9 écoles avec leur logo, occurrences messagingme ingérées par sync incrémental à curseur ascendant `start_id` (cf. règle « Sync MM »). 9 vector stores OpenAI configurés (un par école) pour la base de connaissance. Logos servis depuis `/public/logos/<slug>.png` + `/logos/edh.png` (groupe) + `/logos/messagingme.png` (footer "Propulsé par"), middleware whitelist `/logos/`. Module Mes tableaux : tables `dashboards` + `dashboard_steps` + `dashboard_step_refs` (multi-refs par step pour cumul de volumes, `event_school_slug` pour le mode EDH), auto-save 500ms via RPC PL/pgSQL `replace_dashboard_steps` (atomique, transaction Postgres). Libs charts/UI : `@dnd-kit/core`+`@dnd-kit/sortable` (drag-and-drop), `recharts` (bar chart) + `reaviz` (funnel trapézoïdal), `xlsx` + `jspdf` + `html-to-image` (export Excel/PDF, dynamic import). Scope EDH : sentinelle `'edh'` dans `user_school_access` + cookie `edh_school` + `dashboards.school_slug` ; chip école « EFAP / 3WA / … » en préfixe partout (palette, step refs, accordéons stats).
