export interface School {
  slug: string;
  name: string;
  tokenEnv: string;
  vectorStoreEnv: string;
  /** Public URL of the school's logo, served from /public/logos/<slug>.png. */
  logo: string;
}

/**
 * Path of the EDH group logo (the one above all the schools). Served from
 * the same /public/logos/ directory. Exported separately because it's not
 * tied to any specific school but lives next to its assets.
 */
export const EDH_GROUP_LOGO = "/logos/edh.png";

/** Logo MessagingMe (rendu dans le footer du shell auth-gated). */
export const MESSAGINGME_LOGO = "/logos/messagingme.png";

/**
 * Slug-sentinelle utilisé pour le scope "EDH groupe" (toutes écoles
 * confondues). Stocké :
 *   - en row dans `user_school_access` pour matérialiser l'accès
 *   - en valeur de `dashboards.school_slug` pour les funnels EDH
 *   - en valeur du cookie `edh_school` quand l'utilisateur sélectionne
 *     l'entrée EDH dans la sidebar
 *
 * Distingué de `isValidSchoolSlug` (qui ne reconnaît que les 9 écoles)
 * par `isValidScopeSlug` (qui inclut aussi 'edh').
 */
export const EDH_SCOPE_SLUG = "edh";
export const EDH_SCOPE_NAME = "EDH groupe";

export const SCHOOLS: readonly School[] = [
  { slug: "efap",         name: "EFAP",         tokenEnv: "MM_TOKEN_EFAP",         vectorStoreEnv: "OPENAI_VS_EFAP",         logo: "/logos/efap.png" },
  { slug: "3wa",          name: "3WA",          tokenEnv: "MM_TOKEN_3WA",          vectorStoreEnv: "OPENAI_VS_3WA",          logo: "/logos/3wa.png" },
  { slug: "brassart",     name: "Brassart",     tokenEnv: "MM_TOKEN_BRASSART",     vectorStoreEnv: "OPENAI_VS_BRASSART",     logo: "/logos/brassart.png" },
  { slug: "cesine",       name: "CESINE",       tokenEnv: "MM_TOKEN_CESINE",       vectorStoreEnv: "OPENAI_VS_CESINE",       logo: "/logos/cesine.png" },
  { slug: "efj",          name: "EFJ",          tokenEnv: "MM_TOKEN_EFJ",          vectorStoreEnv: "OPENAI_VS_EFJ",          logo: "/logos/efj.png" },
  { slug: "esec",         name: "ESEC",         tokenEnv: "MM_TOKEN_ESEC",         vectorStoreEnv: "OPENAI_VS_ESEC",         logo: "/logos/esec.png" },
  { slug: "ecole-bleue",  name: "École Bleue",  tokenEnv: "MM_TOKEN_ECOLE_BLEUE",  vectorStoreEnv: "OPENAI_VS_ECOLE_BLEUE",  logo: "/logos/ecole-bleue.png" },
  { slug: "icart",        name: "ICART",        tokenEnv: "MM_TOKEN_ICART",        vectorStoreEnv: "OPENAI_VS_ICART",        logo: "/logos/icart.png" },
  { slug: "ifa",          name: "IFA",          tokenEnv: "MM_TOKEN_IFA",          vectorStoreEnv: "OPENAI_VS_IFA",          logo: "/logos/ifa.png" },
] as const;

const SLUG_SET = new Set(SCHOOLS.map((s) => s.slug));

export function isValidSchoolSlug(slug: string): boolean {
  return SLUG_SET.has(slug);
}

/**
 * Valide les valeurs acceptables pour le cookie `edh_school` ou pour
 * `dashboards.school_slug` : les 9 écoles + le scope EDH.
 */
export function isValidScopeSlug(slug: string): boolean {
  return SLUG_SET.has(slug) || slug === EDH_SCOPE_SLUG;
}

export function isEdhScope(slug: string): boolean {
  return slug === EDH_SCOPE_SLUG;
}

export function getSchoolBySlug(slug: string): School | undefined {
  return SCHOOLS.find((s) => s.slug === slug);
}

export function getSchoolToken(slug: string): string | undefined {
  const s = getSchoolBySlug(slug);
  if (!s) return undefined;
  return process.env[s.tokenEnv];
}

export function getSchoolVectorStoreId(slug: string): string | undefined {
  const s = getSchoolBySlug(slug);
  if (!s) return undefined;
  return process.env[s.vectorStoreEnv];
}

export const DEFAULT_SCHOOL_SLUG = SCHOOLS[0].slug;

/**
 * Logs a warning for each school whose env config is incomplete, plus a
 * single warning if OPENAI_API_KEY is missing. Call at boot (instrumentation)
 * so misconfig surfaces in the logs early, not as silent 401s during a sync
 * run or 500s when someone tries to upload to a knowledge base.
 *
 * Returns the list of school slugs that have at least one piece of missing
 * config. Mostly useful for tests.
 */
export function warnMissingSchoolTokens(): string[] {
  const missing: string[] = [];
  for (const s of SCHOOLS) {
    let hasMissing = false;
    if (!process.env[s.tokenEnv]) {
      hasMissing = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "school messagingme token missing — sync will skip this school",
          school: s.slug,
          envVar: s.tokenEnv,
        })
      );
    }
    if (!process.env[s.vectorStoreEnv]) {
      hasMissing = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "school OpenAI vector store id missing — knowledge uploads will fail",
          school: s.slug,
          envVar: s.vectorStoreEnv,
        })
      );
    }
    if (hasMissing) missing.push(s.slug);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "OPENAI_API_KEY missing — knowledge module disabled",
      })
    );
  }
  return missing;
}
