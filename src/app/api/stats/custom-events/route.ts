import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlugChecked } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import { getSchoolBySlug, isEdhScope, EDH_SCHOOL_SLUGS } from "@/lib/schools";
import { formatInTimeZone } from "date-fns-tz";

export const runtime = "nodejs";

const TZ = "Europe/Paris";
const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }
  const url = new URL(req.url);
  const parsed = Q.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "missing or bad from/to" }, { status: 400 });
  }

  const schoolSlug = await getCurrentSchoolSlugChecked();
  const sb = getSupabase();
  const isEdh = isEdhScope(schoolSlug);

  // En mode EDH, on remonte les events des 9 écoles EDH. Sinon on filtre
  // sur l'école courante. Le filtre IN EDH_SCHOOL_SLUGS est indispensable
  // car la DB est partagée avec d'autres projets qui écrivent dans
  // mm_events avec leurs propres school_slug (ex: keolis-auxerre).
  let q = sb
    .from("mm_events")
    .select("school_slug, event_ns, name, description")
    .order("school_slug")
    .order("name");
  if (isEdh) {
    q = q.in("school_slug", EDH_SCHOOL_SLUGS as string[]);
  } else {
    q = q.eq("school_slug", schoolSlug);
  }
  const { data: events, error } = await q;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Bornes UTC DST-aware. Cf. lib/stats/daily.ts pour la logique.
  const fromOffset = formatInTimeZone(
    new Date(`${parsed.data.from}T00:00:00Z`),
    TZ,
    "XXX"
  );
  const toOffset = formatInTimeZone(
    new Date(`${parsed.data.to}T12:00:00Z`),
    TZ,
    "XXX"
  );
  const fromUtc = `${parsed.data.from}T00:00:00${fromOffset}`;
  const toUtc = `${parsed.data.to}T23:59:59.999${toOffset}`;

  const counts = await Promise.all(
    (events ?? []).map(async (ev) => {
      const { count } = await sb
        .from("mm_occurrences")
        .select("*", { count: "exact", head: true })
        .eq("school_slug", ev.school_slug)
        .eq("event_ns", ev.event_ns)
        .gte("occurred_at", fromUtc)
        .lte("occurred_at", toUtc);
      const school = getSchoolBySlug(ev.school_slug);
      return {
        school_slug: ev.school_slug,
        school_name: school?.name ?? ev.school_slug,
        event_ns: ev.event_ns,
        name: ev.name,
        description: ev.description,
        count: count ?? 0,
      };
    })
  );

  let syncQuery = sb
    .from("mm_sync_state")
    .select("school_slug, event_ns, last_run_at, last_run_status, last_run_error");
  if (isEdh) {
    syncQuery = syncQuery.in("school_slug", EDH_SCHOOL_SLUGS as string[]);
  } else {
    syncQuery = syncQuery.eq("school_slug", schoolSlug);
  }
  const { data: syncs } = await syncQuery;

  return NextResponse.json({ events: counts, syncs: syncs ?? [] });
}
