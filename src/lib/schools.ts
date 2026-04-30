export interface School {
  slug: string;
  name: string;
  tokenEnv: string;
}

export const SCHOOLS: readonly School[] = [
  { slug: "efap",         name: "EFAP",         tokenEnv: "MM_TOKEN_EFAP" },
  { slug: "3wa",          name: "3WA",          tokenEnv: "MM_TOKEN_3WA" },
  { slug: "brassart",     name: "Brassart",     tokenEnv: "MM_TOKEN_BRASSART" },
  { slug: "cesine",       name: "CESINE",       tokenEnv: "MM_TOKEN_CESINE" },
  { slug: "ejf",          name: "EJF",          tokenEnv: "MM_TOKEN_EJF" },
  { slug: "esec",         name: "ESEC",         tokenEnv: "MM_TOKEN_ESEC" },
  { slug: "ecole-bleue",  name: "École Bleue",  tokenEnv: "MM_TOKEN_ECOLE_BLEUE" },
  { slug: "icart",        name: "ICART",        tokenEnv: "MM_TOKEN_ICART" },
  { slug: "ifa",          name: "IFA",          tokenEnv: "MM_TOKEN_IFA" },
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

export const DEFAULT_SCHOOL_SLUG = SCHOOLS[0].slug;

/**
 * Logs a warning for each school whose token env var is unset. Call at boot
 * (instrumentation) so misconfig surfaces in the logs, not as silent 401s
 * during a sync run.
 */
export function warnMissingSchoolTokens(): string[] {
  const missing: string[] = [];
  for (const s of SCHOOLS) {
    if (!process.env[s.tokenEnv]) {
      missing.push(s.slug);
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "school token missing — sync will skip this school",
          school: s.slug,
          envVar: s.tokenEnv,
        })
      );
    }
  }
  return missing;
}
