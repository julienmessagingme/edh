import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import { resolveDateRange } from "@/lib/dashboards/date-range";
import type {
  ComputedStep,
  DashboardStep,
  ComputedDashboardData,
  DatePreset,
} from "@/lib/dashboards/types";

export const runtime = "nodejs";

interface DashboardRow {
  id: string;
  created_by: string;
  school_slug: string;
  date_preset: DatePreset;
  date_from: string | null;
  date_to: string | null;
}

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sb = getSupabase();
  const schoolSlug = await getCurrentSchoolSlug();

  const { data: dash } = await sb
    .from("dashboards")
    .select("id, created_by, school_slug, date_preset, date_from, date_to")
    .eq("id", id)
    .maybeSingle<DashboardRow>();

  if (
    !dash ||
    dash.created_by !== user.userId ||
    dash.school_slug !== schoolSlug
  ) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: stepsData, error: stepsErr } = await sb
    .from("dashboard_steps")
    .select("id, position, step_type, event_ns, redirect_event_id")
    .eq("dashboard_id", id)
    .order("position", { ascending: true });
  if (stepsErr)
    return NextResponse.json({ error: stepsErr.message }, { status: 500 });

  const steps: DashboardStep[] = stepsData ?? [];
  const { from, to } = resolveDateRange({
    preset: dash.date_preset,
    from: dash.date_from,
    to: dash.date_to,
  });
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${nextDay(to)}T00:00:00Z`;

  // Pre-fetch labels in two batches
  const eventNsList = Array.from(
    new Set(steps.filter((s) => s.step_type === "mm_event").map((s) => s.event_ns!))
  );
  const redirectIdList = Array.from(
    new Set(
      steps
        .filter((s) => s.step_type === "url_click")
        .map((s) => s.redirect_event_id!)
    )
  );

  const [mmLabelsRes, redirectLabelsRes] = await Promise.all([
    eventNsList.length > 0
      ? sb
          .from("mm_events")
          .select("event_ns, name")
          .eq("school_slug", schoolSlug)
          .in("event_ns", eventNsList)
      : Promise.resolve({ data: [], error: null }),
    redirectIdList.length > 0
      ? sb
          .from("redirect_events")
          .select("id, name, school_slug")
          .in("id", redirectIdList)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const mmLabels = new Map<string, string>();
  for (const r of (mmLabelsRes.data as { event_ns: string; name: string }[]) ?? []) {
    mmLabels.set(r.event_ns, r.name);
  }
  const redirectLabels = new Map<string, string>();
  for (const r of (redirectLabelsRes.data as {
    id: string;
    name: string;
    school_slug: string;
  }[]) ?? []) {
    // Cross-school redirects are filtered out (not 'available')
    if (r.school_slug === schoolSlug) {
      redirectLabels.set(r.id, r.name);
    }
  }

  const computed: ComputedStep[] = await Promise.all(
    steps.map(async (s): Promise<ComputedStep> => {
      if (s.step_type === "mm_event") {
        const evNs = s.event_ns!;
        const available = mmLabels.has(evNs);
        if (!available) {
          return {
            position: s.position,
            step_type: "mm_event",
            ref_id: evNs,
            label: "(indisponible)",
            count: 0,
            available: false,
          };
        }
        const { count } = await sb
          .from("mm_occurrences")
          .select("*", { count: "exact", head: true })
          .eq("school_slug", schoolSlug)
          .eq("event_ns", evNs)
          .gte("occurred_at", fromTs)
          .lt("occurred_at", toTs);
        return {
          position: s.position,
          step_type: "mm_event",
          ref_id: evNs,
          label: mmLabels.get(evNs)!,
          count: count ?? 0,
          available: true,
        };
      }
      // url_click
      const reId = s.redirect_event_id!;
      const available = redirectLabels.has(reId);
      if (!available) {
        return {
          position: s.position,
          step_type: "url_click",
          ref_id: reId,
          label: "(indisponible)",
          count: 0,
          available: false,
        };
      }
      const { count } = await sb
        .from("clicks")
        .select("*", { count: "exact", head: true })
        .eq("event_id", reId)
        .gte("clicked_at", fromTs)
        .lt("clicked_at", toTs);
      return {
        position: s.position,
        step_type: "url_click",
        ref_id: reId,
        label: redirectLabels.get(reId)!,
        count: count ?? 0,
        available: true,
      };
    })
  );

  const body: ComputedDashboardData = { from, to, steps: computed };
  return NextResponse.json(body);
}
