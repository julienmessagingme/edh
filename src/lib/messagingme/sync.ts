import { getSupabase } from "@/lib/supabase/service";
import { listEvents, iterOccurrences } from "./client";
import { env } from "@/lib/env";
import { SCHOOLS, getSchoolToken, type School } from "@/lib/schools";

export interface SyncResult {
  ok: number;
  errors: number;
  skipped: number;
}

export async function syncAllSchools(): Promise<SyncResult> {
  let ok = 0;
  let errors = 0;
  let skipped = 0;

  for (const school of SCHOOLS) {
    const token = getSchoolToken(school.slug);
    if (!token) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "skip school: no token",
          school: school.slug,
        })
      );
      skipped++;
      continue;
    }
    try {
      await syncSchool(school, token);
      ok++;
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "school sync failed",
          school: school.slug,
          err: err instanceof Error ? err.message : String(err),
        })
      );
      errors++;
    }
  }
  return { ok, errors, skipped };
}

export async function syncSchool(school: School, token: string): Promise<void> {
  const sb = getSupabase();
  const base = env.messagingmeBase;
  const events = await listEvents({ token, base });

  // Refresh the events catalog for this school. We upsert so renames /
  // description changes propagate and a removed event simply stops getting
  // its occurrences synced (we don't delete the row to preserve historical
  // occurrences and stats).
  if (events.length > 0) {
    const { error } = await sb.from("mm_events").upsert(
      events.map((e) => ({
        school_slug: school.slug,
        event_ns: e.event_ns,
        name: e.name,
        description: e.description,
        text_label: e.text_label,
        price_label: e.price_label,
        number_label: e.number_label,
        last_synced_at: new Date().toISOString(),
      })),
      { onConflict: "school_slug,event_ns" }
    );
    if (error) throw error;
  }

  for (const ev of events) {
    try {
      await syncEventOccurrences(school.slug, ev.event_ns, token, base);
      await sb.from("mm_sync_state").upsert(
        {
          school_slug: school.slug,
          event_ns: ev.event_ns,
          last_run_at: new Date().toISOString(),
          last_run_status: "success",
          last_run_error: null,
        },
        { onConflict: "school_slug,event_ns" }
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "event sync failed",
          school: school.slug,
          event_ns: ev.event_ns,
          err: err instanceof Error ? err.message : String(err),
        })
      );
      await sb.from("mm_sync_state").upsert(
        {
          school_slug: school.slug,
          event_ns: ev.event_ns,
          last_run_at: new Date().toISOString(),
          last_run_status: "error",
          last_run_error: err instanceof Error ? err.message : String(err),
        },
        { onConflict: "school_slug,event_ns" }
      );
      // Continue to the next event — one bad event shouldn't poison the
      // rest of the school's sync.
    }
  }
}

async function syncEventOccurrences(
  schoolSlug: string,
  eventNs: string,
  token: string,
  base: string
): Promise<void> {
  const sb = getSupabase();

  const { data: state } = await sb
    .from("mm_sync_state")
    .select("last_occurrence_id")
    .eq("school_slug", schoolSlug)
    .eq("event_ns", eventNs)
    .maybeSingle();
  const watermark = state?.last_occurrence_id ?? 0;

  let maxIngested = watermark;

  // The MM API returns occurrences in ascending id order, so new ones land on
  // the LAST pages. We resume from the watermark via start_id (an EXCLUSIVE
  // cursor : id > watermark), walk every page to the tail, and upsert each.
  // We pass `watermark` directly (not watermark + 1) precisely because the
  // bound is exclusive. When watermark is 0 we omit start_id for a full scan.
  const startId = watermark > 0 ? watermark : undefined;
  for await (const batch of iterOccurrences({ token, base }, eventNs, startId)) {
    // Use upsert (not insert) so a transient failure mid-pagination doesn't
    // leave us stuck : retrying re-fetches overlapping rows, and upsert with
    // ignoreDuplicates makes those re-inserts a no-op on the (school_slug, id)
    // PK. The watermark is only persisted at the end, so an error here means
    // we simply re-scan from the old watermark next run — no gaps.
    const { error } = await sb
      .from("mm_occurrences")
      .upsert(
        batch.map((o) => ({
          id: o.id,
          school_slug: schoolSlug,
          event_ns: o.event_ns,
          user_ns: o.user_ns,
          text_value: o.text_value,
          price_value: parsePriceValue(o.price_value),
          number_value: o.number_value,
          occurred_at: o.created_at,
        })),
        { onConflict: "school_slug,id", ignoreDuplicates: true }
      );
    if (error) throw error;
    for (const o of batch) {
      if (o.id > maxIngested) maxIngested = o.id;
    }
  }

  if (maxIngested > watermark) {
    const { error } = await sb.from("mm_sync_state").upsert(
      {
        school_slug: schoolSlug,
        event_ns: eventNs,
        last_occurrence_id: maxIngested,
      },
      { onConflict: "school_slug,event_ns" }
    );
    if (error) throw error;
  }
}

function parsePriceValue(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
