import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlugChecked } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import { getSchoolBySlug, isEdhScope, EDH_SCHOOL_SLUGS } from "@/lib/schools";
import type { Palette, PaletteItem } from "@/lib/dashboards/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }
  const schoolSlug = await getCurrentSchoolSlugChecked();
  const sb = getSupabase();
  const isEdh = isEdhScope(schoolSlug);

  // En mode EDH on agrège sur les 9 écoles EDH (filtre IN obligatoire car
  // la DB est partagée avec d'autres projets). Chaque item porte alors
  // `school_slug` + `school_name` pour l'affichage (chip).
  const mmQuery = sb
    .from("mm_events")
    .select("school_slug, event_ns, name")
    .order("school_slug")
    .order("name");
  const redirectQuery = sb
    .from("redirect_events")
    .select("id, name, school_slug")
    .is("archived_at", null)
    .order("school_slug")
    .order("name");

  const [mmRes, redirectsRes] = await Promise.all([
    isEdh
      ? mmQuery.in("school_slug", EDH_SCHOOL_SLUGS as string[])
      : mmQuery.eq("school_slug", schoolSlug),
    isEdh
      ? redirectQuery.in("school_slug", EDH_SCHOOL_SLUGS as string[])
      : redirectQuery.eq("school_slug", schoolSlug),
  ]);
  if (mmRes.error)
    return NextResponse.json({ error: mmRes.error.message }, { status: 500 });
  if (redirectsRes.error)
    return NextResponse.json({ error: redirectsRes.error.message }, { status: 500 });

  const mmEvents: PaletteItem[] = (
    (mmRes.data ?? []) as { school_slug: string; event_ns: string; name: string }[]
  ).map((r) => {
    const item: PaletteItem = {
      step_type: "mm_event",
      // En EDH, l'identité d'une ref est (school, event_ns) : on
      // compose un id composite côté UI pour ne pas écraser un event
      // qui s'appellerait pareil dans deux écoles.
      ref_id: isEdh ? `${r.school_slug}:${r.event_ns}` : r.event_ns,
      label: r.name,
    };
    if (isEdh) {
      item.school_slug = r.school_slug;
      item.school_name = getSchoolBySlug(r.school_slug)?.name ?? r.school_slug;
    }
    return item;
  });
  const redirectEvents: PaletteItem[] = (
    (redirectsRes.data ?? []) as {
      id: string;
      name: string;
      school_slug: string;
    }[]
  ).map((r) => {
    const item: PaletteItem = {
      step_type: "url_click",
      ref_id: r.id,
      label: r.name,
    };
    if (isEdh) {
      item.school_slug = r.school_slug;
      item.school_name = getSchoolBySlug(r.school_slug)?.name ?? r.school_slug;
    }
    return item;
  });

  const body: Palette = { mmEvents, redirectEvents };
  return NextResponse.json(body);
}
