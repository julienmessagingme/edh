export interface School {
  slug: string;
  name: string;
  tokenEnv: string;
  vectorStoreEnv: string;
}

export const SCHOOLS: readonly School[] = [
  { slug: "efap",         name: "EFAP",         tokenEnv: "MM_TOKEN_EFAP",         vectorStoreEnv: "OPENAI_VS_EFAP" },
  { slug: "3wa",          name: "3WA",          tokenEnv: "MM_TOKEN_3WA",          vectorStoreEnv: "OPENAI_VS_3WA" },
  { slug: "brassart",     name: "Brassart",     tokenEnv: "MM_TOKEN_BRASSART",     vectorStoreEnv: "OPENAI_VS_BRASSART" },
  { slug: "cesine",       name: "CESINE",       tokenEnv: "MM_TOKEN_CESINE",       vectorStoreEnv: "OPENAI_VS_CESINE" },
  { slug: "ejf",          name: "EJF",          tokenEnv: "MM_TOKEN_EJF",          vectorStoreEnv: "OPENAI_VS_EJF" },
  { slug: "esec",         name: "ESEC",         tokenEnv: "MM_TOKEN_ESEC",         vectorStoreEnv: "OPENAI_VS_ESEC" },
  { slug: "ecole-bleue",  name: "École Bleue",  tokenEnv: "MM_TOKEN_ECOLE_BLEUE",  vectorStoreEnv: "OPENAI_VS_ECOLE_BLEUE" },
  { slug: "icart",        name: "ICART",        tokenEnv: "MM_TOKEN_ICART",        vectorStoreEnv: "OPENAI_VS_ICART" },
  { slug: "ifa",          name: "IFA",          tokenEnv: "MM_TOKEN_IFA",          vectorStoreEnv: "OPENAI_VS_IFA" },
] as const;

const SLUG_SET = new Set(SCHOOLS.map((s) => s.slug));

export function isValidSchoolSlug(slug: string): boolean {
  return SLUG_SET.has(slug);
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
