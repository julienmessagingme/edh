import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import type { Palette, PaletteItem } from "@/lib/dashboards/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }
  const schoolSlug = await getCurrentSchoolSlug();
  const sb = getSupabase();

  const [mmRes, redirectsRes] = await Promise.all([
    sb
      .from("mm_events")
      .select("event_ns, name")
      .eq("school_slug", schoolSlug)
      .order("name"),
    sb
      .from("redirect_events")
      .select("id, name")
      .eq("school_slug", schoolSlug)
      .is("archived_at", null)
      .order("name"),
  ]);
  if (mmRes.error)
    return NextResponse.json({ error: mmRes.error.message }, { status: 500 });
  if (redirectsRes.error)
    return NextResponse.json({ error: redirectsRes.error.message }, { status: 500 });

  const mmEvents: PaletteItem[] = ((mmRes.data ?? []) as {
    event_ns: string;
    name: string;
  }[]).map((r) => ({
    step_type: "mm_event",
    ref_id: r.event_ns,
    label: r.name,
  }));
  const redirectEvents: PaletteItem[] = ((redirectsRes.data ?? []) as {
    id: string;
    name: string;
  }[]).map((r) => ({
    step_type: "url_click",
    ref_id: r.id,
    label: r.name,
  }));

  const body: Palette = { mmEvents, redirectEvents };
  return NextResponse.json(body);
}
