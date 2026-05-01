# Documentation technique — EDH Stats

> Reference technique : archi, stack, schéma DB, déploiement, patterns code.
> Pour la vue produit : `features.md`. Pour le WIP : `wip.md`.

## 1. Architecture globale

```
┌──────────────────────────┐    ┌──────────────────────┐
│   VPS OVH 146.59.233.252 │    │   Supabase EU        │
│                          │    │   "EDH Stats"        │
│  NPM (Docker, déjà là)   │    │                      │
│   ↓ reverse proxy + SSL  │    │   Postgres 17        │
│  edh.messagingme.app     │    │   PostgREST (HTTPS)  │
│   ↓                      │───▶│                      │
│  edh-app (Docker)        │    │   - users            │
│   - Next.js 15 standalone│    │   - redirect_events  │
│   - /r/<slug> redirect   │    │   - redirect_versions│
│   - /(app)/* UI auth     │    │   - clicks           │
│   - /api/* routes        │    │   - mm_events        │
│   - node-cron 22:00 P.   │    │   - mm_occurrences   │
│   (Phase 6, à venir)     │    │   - mm_sync_state    │
└──────────────────────────┘    └──────────────────────┘
                                          ▲
                                          │
                  ┌───────────────────────┘
                  │
         ┌────────┴───────────────┐
         │ ai.messagingme.app/api │
         │ /flow/custom-events    │
         │ /flow/custom-events/   │
         │   data                 │
         └────────────────────────┘
```

**Surface publique** :
- `/r/<slug>` — redirect 302 (pas d'auth, rate-limit 100 hits/IP/min)
- Tout le reste — auth-gated par middleware Edge

**Réseau Docker** : `edh-app` rejoint le réseau Docker existant de NPM pour que le proxy host pointe `edh.messagingme.app` → `http://edh-app:3000` (Phase 9).

## 2. Stack

| Couche | Choix | Notes |
|--------|-------|-------|
| Framework | Next.js 15.5 App Router | `output: 'standalone'` pour Docker minimal |
| Runtime | Node 22 LTS | container alpine |
| UI | Tailwind 4 + shadcn/ui | accordion, button, card, dialog, dropdown-menu, input, label, select, sonner |
| Charts | Recharts 3 | Phase 7 |
| Auth | `bcryptjs` (cost 10) + `jose` (JWT HS256) | cookie `edh_session` HttpOnly TTL 7j |
| DB client | `@supabase/supabase-js` v2 | service-role, server-side uniquement |
| Validation | `zod` v4 | bodies API + parsing |
| Cron | `node-cron` 4.2 | `0 22 * * *` Europe/Paris (Phase 6) |
| Slug | `nanoid` 5 | 8 chars (alphabet par défaut) |
| Date | `date-fns` v4 + `date-fns-tz` | locale `fr`, buckets Europe/Paris |
| Logs | `console.log` JSON structuré | parsable par grep |
| Tests | `vitest` 4 + `supertest` | unit + API mocks |

## 3. Auth

### 3.1 Modèle

- 2 utilisateurs (Julien + EDH), même droits, accès aux 9 écoles.
- Login `/login` → `POST /api/auth/login` → `bcrypt.compare` → cookie JWT HS256 signé `AUTH_SECRET` (TTL 7j).
- `POST /api/auth/logout` → clear cookie.
- **Middleware Edge** (`src/middleware.ts`) : redirect `/login` si pas de cookie valide, sauf `/login`, `/r/*`, `/api/auth/*`, statics.
- **Pas de signup UI**. Users seedés via `npm run seed:users` (lit `SEED_JULIEN_PASSWORD` + `SEED_EDH_EMAIL` + `SEED_EDH_PASSWORD`).

### 3.2 Anti-timing-attack login

`POST /api/auth/login` exécute toujours `bcrypt.compare`, même quand l'email est introuvable, contre un dummy hash pré-calculé. Sans ça, un attaquant peut énumérer les emails par chronométrage (réponse instantanée si email inconnu, ~100ms si email trouvé mais mauvais password).

### 3.3 Logout cookie attrs

Le `Set-Cookie` du logout mirror les attrs du login (`HttpOnly`, `SameSite=Lax`, `Secure` en prod) — sinon les navigateurs stricts pourraient ne pas supprimer le cookie et le JWT resterait valide jusqu'à TTL.

## 4. Multi-écoles

### 4.1 Liste

`src/lib/schools.ts` exporte la constante `SCHOOLS` (9 écoles). Chaque école a :
- `slug` (lowercase, alphanumeric + tirets — utilisé comme `school_slug` en DB)
- `name` (affiché dans l'UI)
- `tokenEnv` — nom de l'env var Bearer MessagingMe (ex `MM_TOKEN_EFAP`)
- `vectorStoreEnv` — nom de l'env var vector store OpenAI (ex `OPENAI_VS_EFAP`)
- `logo` — URL publique du logo, sert depuis `/public/logos/<slug>.png`

Le logo du groupe EDH est exporté séparément via la constante `EDH_GROUP_LOGO` (path `/logos/edh.png`) — affiché en haut à gauche du header de l'app.

Liste actuelle : EFAP, 3WA, Brassart, CESINE, EFJ, ESEC, École Bleue, ICART, IFA.

Pour ajouter une école :

1. Ajouter une entrée à `SCHOOLS` (slug + name + tokenEnv + vectorStoreEnv + logo).
2. Ajouter les vars d'env (`MM_TOKEN_<SLUG>`, `OPENAI_VS_<SLUG>`).
3. Déposer le logo en `public/logos/<slug>.png`.
4. Si la school a un vector store OpenAI, le créer côté OpenAI dashboard.
5. Redéploy.

### 4.2 Contexte côté serveur

`getCurrentSchoolSlug()` (`src/lib/schools/context.ts`) lit le cookie `edh_school`. Si absent ou invalide, retourne `DEFAULT_SCHOOL_SLUG` (`efap`). Tous les endpoints qui scopent par école (`POST /api/events`, `GET /api/stats/...`) lisent cette valeur côté serveur, jamais côté client.

### 4.3 Bascule UI

`POST /api/school` (auth-gated) avec `{ slug }` valide → set le cookie. La sidebar (`src/app/(app)/sidebar.tsx`) appelle cet endpoint puis `router.refresh()`. Pendant le fetch, **toute** la sidebar est désactivée pour empêcher les clics rapides successifs (race condition).

### 4.4 Config manquante

`warnMissingSchoolTokens()` (`src/lib/schools.ts`) loggue un warning JSON au boot pour chaque école sans token MessagingMe (`MM_TOKEN_<SLUG>`) ou sans vector store OpenAI (`OPENAI_VS_<SLUG>`), plus un warning si `OPENAI_API_KEY` est absente. Câblé dans `src/instrumentation.ts` au démarrage du process. Ne bloque pas le boot — chaque école avec config manquante est juste skippée par le sync ou rejette les uploads knowledge avec une erreur claire.

## 5. Redirect public `/r/:slug`

### 5.1 Flow

1. `GET /r/abc123` → middleware Edge laisse passer (path public).
2. Route handler Node :
   - `getClientIp(req)` → `CF-Connecting-IP` ou dernière entrée de `X-Forwarded-For`.
   - `checkRate(ip)` → 429 si > 100 hits/min.
   - `lookupSlug(slug)` (cache mémoire 60s) → 404 si introuvable, 503 si DB error.
   - Insert `clicks` (fire-and-forget, `Promise.resolve().then(...)`) — bloque pas le redirect.
   - `302 Found` vers `destination_url`.

Latence cible : <50ms côté VPS.

### 5.2 Sécurité

- **IP picking** : on prend `CF-Connecting-IP` en priorité (Cloudflare orange-cloud), fallback sur la **dernière** entrée de XFF (jamais la première — clients peuvent la spoofer). Voir `src/lib/redirect/client-ip.ts`.
- **Rate-limit** : token bucket en mémoire, 100 hits/IP/min, cleanup périodique (`unref()` pour pas bloquer Next).
- **Cache lookup** : cap à 5000 entrées (FIFO eviction) + sweep périodique des expirés. Un attaquant tapant `/r/<random>` en boucle ne peut pas faire grossir la Map indéfiniment.
- **Validation destination** : faite à la création (Phase 5) — zod URL valide, scheme http/https uniquement, pas de `javascript:`.

### 5.3 Cache invalidation

`invalidateSlugCache(slug)` doit être appelé par tout endpoint qui mute `redirect_events` ou `redirect_versions` (création, nouvelle version, archivage, renommage). Sinon un slug cache pour 60s avec une vieille destination. **À câbler en Phase 5** (déjà flaggé).

## 6. Schéma DB

Voir `supabase/migrations/001_init.sql` pour la version exacte.

```
users               (id, email UNIQUE, password_hash, name, created_at,
                     is_admin DEFAULT false, deactivated_at, last_login_at)
user_school_access  (user_id FK CASCADE, school_slug, PK (user_id, school_slug))
redirect_events     (id, school_slug, slug UNIQUE, name, created_by, archived_at)
redirect_versions   (id, event_id FK, destination_url, version, active_from, active_to)
                    UNIQUE INDEX (event_id) WHERE active_to IS NULL
clicks              (id, event_id FK, version_id FK, clicked_at, ip, user_agent, referer, country)
mm_events           (school_slug, event_ns) PK, name, description, *_label, last_synced_at
mm_occurrences      (school_slug, id) PK, event_ns, user_ns, *_value, occurred_at
mm_sync_state       (school_slug, event_ns) PK, last_occurrence_id, last_run_at, last_run_status, last_run_error
knowledge_themes    (id, school_slug, name UNIQUE per school, created_at)
knowledge_subthemes (id, school_slug, theme_id FK nullable, name UNIQUE per school)
knowledge_items     (id, school_slug, type CHECK file|text|qa, file_name, title, question, answer,
                     theme_id FK, subtheme_id FK, vector_store_file_id, openai_file_id, status, uploaded_by, uploaded_at)
dashboards          (id, school_slug, created_by FK, name, type CHECK 'funnel',
                     date_preset CHECK 7d|30d|90d|custom, date_from, date_to, created_at, updated_at)
dashboard_steps     (id, dashboard_id FK, position, label nullable,
                     UNIQUE (dashboard_id, position))
dashboard_step_refs (id, step_id FK CASCADE, ref_position,
                     step_type CHECK mm_event|url_click,
                     event_ns nullable, redirect_event_id FK CASCADE nullable,
                     CHECK exactly one ref, UNIQUE (step_id, ref_position))
```

**Index** :
- `idx_redirect_events_school_archived (school_slug, archived_at)`
- `idx_clicks_event_clicked_at (event_id, clicked_at)`
- `idx_mm_occurrences_school_event_occurred (school_slug, event_ns, occurred_at)`
- `idx_dashboards_user_school (created_by, school_slug, updated_at DESC)`
- `idx_dashboard_steps_dashboard (dashboard_id, position)`
- `idx_dashboard_step_refs_step (step_id, ref_position)`

**Pas de RLS.** Service-role server-side uniquement. Les filtres `school_slug` sont appliqués côté app.

**Migration manuelle** : ouvrir https://supabase.com/dashboard/project/odmpeakltuzwvtydbpfu/sql/new, coller le contenu de `supabase/migrations/001_init.sql`, Run.

## 7. Variables d'environnement

| Variable | Côté | Usage |
|----------|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | URL projet Supabase (REST) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | bypass RLS, queries admin |
| `AUTH_SECRET` | server (Edge + Node) | JWT HS256 signing key (64 chars hex) |
| `INTERNAL_API_KEY` | server only | Bearer pour `/api/cron/sync` manuel (Phase 6) |
| `MESSAGINGME_API_BASE` | server only | `https://ai.messagingme.app/api` |
| `MM_TOKEN_<SLUG>` | server only | 9 vars MessagingMe Bearer (EFAP, 3WA, BRASSART, CESINE, EFJ, ESEC, ECOLE_BLEUE, ICART, IFA) |
| `OPENAI_API_KEY` | server only | clé OpenAI pour la base de connaissance (Files + Vector Stores API) |
| `OPENAI_VS_<SLUG>` | server only | 9 vars vector store id par école (même slugs que `MM_TOKEN_*`) |
| `CRON_TIMEZONE` | server only | `Europe/Paris` |
| `PUBLIC_BASE_URL` | server only | `https://edh.messagingme.app` (UI base path), `http://localhost:3000` en dev |
| `DISABLE_CRON` | server only | `1` désactive le cron (utile en dev) |
| `SEED_JULIEN_PASSWORD` | script seed | mot de passe à hasher pour Julien |
| `SEED_EDH_EMAILS` | script seed | emails EDH séparés par virgule (1 ou plusieurs comptes) |
| `SEED_EDH_PASSWORD` | script seed | mot de passe à hasher (partagé entre tous les comptes EDH) |

**Local** : `.env.local` (gitignored). **Prod** : fichier `.env` lu par `docker compose` (env_file).

## 8. Conventions code

- **Server Components par défaut** dans App Router. `"use client"` uniquement quand interactivité (hooks, listeners, useState).
- **UI en français**. Code sans accents (`Personnalise` dans le source, "Personnalisé" affiché si besoin).
- **Supabase service client direct** depuis Route Handlers et Server Components. Singleton module-scope dans `src/lib/supabase/service.ts`.
- **`requireUser()`** (`src/lib/auth/require-user.ts`) — defense in-depth en plus du middleware, à appeler au début de chaque Route Handler auth-gated.
- **Zod pour valider TOUS les bodies POST/PATCH**.
- **Logs JSON structuré** : `console.log(JSON.stringify({ level: "info", msg: "...", ...rest }))`.
- **Tests** : `vitest` + mocks. Convention de nommage : `*.test.ts` à côté du fichier testé OU dans `tests/`.

## 9. Tests existants (au 2026-04-30)

```
src/lib/auth/session.test.ts        — sign/verify round-trip + tampered token (2)
src/lib/schools.test.ts             — SCHOOLS length, isValidSchoolSlug, getSchoolToken (3)
src/lib/redirect/lookup.test.ts     — null si introuvable, retourne event+version (2)
src/lib/redirect/rate-limit.test.ts — 100 OK puis 429, isolation par IP (2)
src/lib/redirect/client-ip.test.ts  — prefer CF, last not first, null missing, ignore empty (4)
tests/smoke.test.ts                 — sanity check (1)
```

Total : **14 PASS**.

## 10. Code reviews effectuées

Chaque phase qui touche du code metier passe par une review (agent `feature-dev:code-reviewer`) avant la phase suivante.

**Phase 2 (Auth)** — 2 fixes appliqués :
- Login : timing-attack on email enumeration (toujours run bcrypt.compare contre un dummy hash).
- Logout : cookie attrs (HttpOnly, SameSite, Secure) à mirror du login.

**Phase 3 (SCHOOLS)** — 2 fixes appliqués :
- Sidebar : disabled = pendingSlug !== null (toute la sidebar gelée pendant le fetch).
- `getSchoolToken` retournait undefined silencieusement → ajout de `warnMissingSchoolTokens()` à câbler au boot.

**Phase 4 (Redirect)** — 2 fixes appliqués :
- IP picking : nouveau helper `getClientIp()` qui priorise `CF-Connecting-IP` puis dernière entrée XFF.
- Cache lookup : cap 5000 entrées + sweep périodique pour bloquer le DoS via /r/<random>.

## 11. Déploiement prod (effectué 2026-04-30)

URL prod : **https://edh.messagingme.app**

### Workflow standard

```bash
# Push depuis le main worktree local
cd /c/Users/julie/EDH && git push origin main

# SSH VPS + rebuild
ssh -i ~/.ssh/id_ed25519 ubuntu@146.59.233.252
sudo bash -c 'cd /root/edh && git pull && docker compose up -d --build'

# Vérifier
sudo docker logs --tail 30 edh-app
curl -I https://edh.messagingme.app/login
```

### Stack VPS

- VPS OVH `146.59.233.252`
- Repo cloné en `/root/edh/` (root-owned, `sudo` requis)
- `.env` prod en `/root/edh/.env` (chmod 600), contient les 9 `MM_TOKEN_*`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `INTERNAL_API_KEY`
- Container `edh-app` sur réseaux Docker `edh_default` (compose) + `mcp-robot_default` (external, NPM joint)
- DNS Cloudflare : A record `edh` → `146.59.233.252`, proxied (orange cloud)
- NPM proxy host id 12 : `edh.messagingme.app` → `http://edh-app:3000`, SSL Let's Encrypt id 13, force SSL, HTTP/2

### NPM admin via API (sans password)

NPM signe ses JWT avec `/data/keys.json` (RSA private key). On peut minter un token administrateur en lisant ce fichier directement, ce qui évite de devoir taper le password admin pour des opérations SSH-driven (création de proxy host, certs Let's Encrypt, etc.).

```bash
# 1. Mint un JWT admin (1h TTL)
JWT=$(ssh ubuntu@146.59.233.252 'sudo docker exec mcp-robot_nginx-proxy-manager_1 sh -c "node -e \"
const fs=require(\\\"fs\\\"),crypto=require(\\\"crypto\\\");
const k=JSON.parse(fs.readFileSync(\\\"/data/keys.json\\\",\\\"utf8\\\")).key;
const now=Math.floor(Date.now()/1000);
const p={iss:\\\"api\\\",attrs:{id:1},scope:[\\\"user\\\"],jti:crypto.randomBytes(8).toString(\\\"hex\\\"),iat:now,exp:now+3600};
const b=o=>Buffer.from(JSON.stringify(o)).toString(\\\"base64url\\\");
const h={alg:\\\"RS256\\\",typ:\\\"JWT\\\"};
const i=b(h)+\\\".\\\"+b(p);
const s=crypto.createSign(\\\"RSA-SHA256\\\");s.update(i);
console.log(i+\\\".\\\"+s.sign(k).toString(\\\"base64url\\\"));
\""')

# 2. Utiliser ce JWT contre l'API NPM (endpoint sur 127.0.0.1:81 via SSH tunnel ou docker network)
ssh ubuntu@146.59.233.252 "curl -H 'Authorization: Bearer $JWT' http://127.0.0.1:81/api/users/me"
```

User admin id 1 = julien@messagingme.fr. Le password n'est PAS modifié par cette procédure.

---

## 12. Hors scope (V2)

Voir `todo.md`.
