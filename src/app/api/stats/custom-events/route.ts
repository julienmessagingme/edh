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
    .from("mm_events")
    .select("event_ns, name, description")
    .eq("school_slug", schoolSlug)
    .order("name");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute UTC bounds, DST-aware. See lib/stats/daily.ts for the rationale
  // behind the asymmetric offset sampling (T00:00:00Z for from, T12:00:00Z
  // for to) — this protects against autumn fall-back days losing the last
  // two hours of the window.
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
        .eq("school_slug", schoolSlug)
        .eq("event_ns", ev.event_ns)
        .gte("occurred_at", fromUtc)
        .lte("occurred_at", toUtc);
      return { ...ev, count: count ?? 0 };
    })
  );

  const { data: syncs } = await sb
    .from("mm_sync_state")
    .select("event_ns, last_run_at, last_run_status, last_run_error")
    .eq("school_slug", schoolSlug);

  return NextResponse.json({ events: counts, syncs: syncs ?? [] });
}
