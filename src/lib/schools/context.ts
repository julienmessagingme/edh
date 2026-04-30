import { cookies } from "next/headers";
import { isValidSchoolSlug, DEFAULT_SCHOOL_SLUG } from "@/lib/schools";

export const SCHOOL_COOKIE_NAME = "edh_school";

export async function getCurrentSchoolSlug(): Promise<string> {
  const c = await cookies();
  const v = c.get(SCHOOL_COOKIE_NAME)?.value;
  if (v && isValidSchoolSlug(v)) return v;
  return DEFAULT_SCHOOL_SLUG;
}
