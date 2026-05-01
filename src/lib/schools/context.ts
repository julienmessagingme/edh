import { cookies } from "next/headers";
import { isValidSchoolSlug, DEFAULT_SCHOOL_SLUG } from "@/lib/schools";
import { getCurrentUserSchools } from "@/lib/schools/access";
import { requireUser } from "@/lib/auth/require-user";

export const SCHOOL_COOKIE_NAME = "edh_school";

export async function getCurrentSchoolSlug(): Promise<string> {
  const c = await cookies();
  const v = c.get(SCHOOL_COOKIE_NAME)?.value;
  if (v && isValidSchoolSlug(v)) return v;
  return DEFAULT_SCHOOL_SLUG;
}

/**
 * Like `getCurrentSchoolSlug` but enforces that the current user has access
 * to the slug. Falls back to the user's first accessible school if the
 * cookie's slug is no longer accessible (e.g. an admin revoked it). Throws
 * 403 if the user has zero accessible schools.
 *
 * Use this in any user-facing API route that depends on the current school
 * to avoid leaking data across schools the user shouldn't see.
 */
export async function getCurrentSchoolSlugChecked(): Promise<string> {
  const slug = await getCurrentSchoolSlug();
  const user = await requireUser();
  const schools = await getCurrentUserSchools(user.userId);
  if (schools.length === 0) {
    throw Object.assign(new Error("no school access"), { status: 403 });
  }
  if (schools.includes(slug)) return slug;
  return schools[0];
}
