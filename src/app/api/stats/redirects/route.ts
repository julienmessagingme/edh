import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlugChecked } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import { formatInTimeZone } from "date-fns-tz";

export const runtime = "nodejs";

const TZ = "Europe/Paris";
const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * GET /api/stats/redirects?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Liste les URLs trackées (non archivées) de l'école courante, avec le
 * nombre de clics sur la période. Analogue à /api/stats/custom-events
 * pour les events MessagingMe.
 */
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

  const { data: events, error } = await sb
    .from("redirect_events")
    .select("id, slug, name")
    .eq("school_slug", schoolSlug)
    .is("archived_at", null)
    .order("name");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Bornes UTC DST-aware (cf. /api/stats/custom-events).
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
        .from("clicks")
        .select("*", { count: "exact", head: true })
        .eq("event_id", ev.id)
        .gte("clicked_at", fromUtc)
        .lte("clicked_at", toUtc);
      return { ...ev, count: count ?? 0 };
    })
  );

  return NextResponse.json({ redirects: counts });
}
