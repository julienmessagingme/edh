import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import { resolveDateRange } from "@/lib/dashboards/date-range";
import type {
  ComputedRef,
  ComputedStep,
  ComputedDashboardData,
  DatePreset,
  StepType,
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

interface StepRow {
  id: string;
  position: number;
  label: string | null;
}

interface RefRow {
  id: string;
  step_id: string;
  ref_position: number;
  step_type: StepType;
  event_ns: string | null;
  redirect_event_id: string | null;
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
    .select("id, position, label")
    .eq("dashboard_id", id)
    .order("position", { ascending: true });
  if (stepsErr)
    return NextResponse.json({ error: stepsErr.message }, { status: 500 });

  const stepRows = (stepsData ?? []) as StepRow[];

  const { from, to } = resolveDateRange({
    preset: dash.date_preset,
    from: dash.date_from,
    to: dash.date_to,
  });
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${nextDay(to)}T00:00:00Z`;

  if (stepRows.length === 0) {
    const empty: ComputedDashboardData = { from, to, steps: [] };
    return NextResponse.json(empty);
  }

  const stepIds = stepRows.map((s) => s.id);
  const { data: refsData, error: refsErr } = await sb
    .from("dashboard_step_refs")
    .select("id, step_id, ref_position, step_type, event_ns, redirect_event_id")
    .in("step_id", stepIds)
    .order("ref_position", { ascending: true });
  if (refsErr)
    return NextResponse.json({ error: refsErr.message }, { status: 500 });

  const refRows = (refsData ?? []) as RefRow[];

  // Pre-fetch labels
  const eventNsList = Array.from(
    new Set(refRows.filter((r) => r.step_type === "mm_event").map((r) => r.event_ns!))
  );
  const redirectIdList = Array.from(
    new Set(
      refRows.filter((r) => r.step_type === "url_click").map((r) => r.redirect_event_id!)
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
    if (r.school_slug === schoolSlug) {
      redirectLabels.set(r.id, r.name);
    }
  }

  // Compute counts for each ref in parallel
  const refsByStep = new Map<string, RefRow[]>();
  for (const r of refRows) {
    const arr = refsByStep.get(r.step_id) ?? [];
    arr.push(r);
    refsByStep.set(r.step_id, arr);
  }

  async function computeRef(r: RefRow): Promise<ComputedRef> {
    if (r.step_type === "mm_event") {
      const evNs = r.event_ns!;
      const available = mmLabels.has(evNs);
      if (!available) {
        return {
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
        step_type: "mm_event",
        ref_id: evNs,
        label: mmLabels.get(evNs)!,
        count: count ?? 0,
        available: true,
      };
    }
    const reId = r.redirect_event_id!;
    const available = redirectLabels.has(reId);
    if (!available) {
      return {
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
      step_type: "url_click",
      ref_id: reId,
      label: redirectLabels.get(reId)!,
      count: count ?? 0,
      available: true,
    };
  }

  const computed: ComputedStep[] = await Promise.all(
    stepRows.map(async (s): Promise<ComputedStep> => {
      const stepRefs = refsByStep.get(s.id) ?? [];
      const computedRefs = await Promise.all(stepRefs.map(computeRef));
      const total = computedRefs
        .filter((r) => r.available)
        .reduce((sum, r) => sum + r.count, 0);
      const anyAvailable = computedRefs.some((r) => r.available);
      const fallbackLabel =
        computedRefs.length === 0
          ? "(vide)"
          : computedRefs.map((r) => r.label).join(" + ");
      return {
        position: s.position,
        label: s.label && s.label.trim() ? s.label : fallbackLabel,
        count: anyAvailable ? total : 0,
        available: anyAvailable && computedRefs.length > 0,
        refs: computedRefs,
      };
    })
  );

  const body: ComputedDashboardData = { from, to, steps: computed };
  return NextResponse.json(body);
}
