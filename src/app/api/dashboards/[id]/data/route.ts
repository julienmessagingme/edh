import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlugChecked } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import { resolveDateRange } from "@/lib/dashboards/date-range";
import { getSchoolBySlug, isEdhScope } from "@/lib/schools";
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
  event_school_slug: string | null;
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
  const scope = await getCurrentSchoolSlugChecked();
  const isEdh = isEdhScope(scope);

  const { data: dash } = await sb
    .from("dashboards")
    .select("id, created_by, school_slug, date_preset, date_from, date_to")
    .eq("id", id)
    .maybeSingle<DashboardRow>();

  if (
    !dash ||
    dash.created_by !== user.userId ||
    dash.school_slug !== scope
  ) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Capture non-null pour que TS ne perde pas le narrowing à l'intérieur
  // de la closure `computeRef`.
  const dashSchool = dash.school_slug;

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
    .select(
      "id, step_id, ref_position, step_type, event_ns, redirect_event_id, event_school_slug"
    )
    .in("step_id", stepIds)
    .order("ref_position", { ascending: true });
  if (refsErr)
    return NextResponse.json({ error: refsErr.message }, { status: 500 });

  const refRows = (refsData ?? []) as RefRow[];

  // Pour chaque mm_event ref, l'école est event_school_slug en mode EDH,
  // sinon le school_slug du dashboard. Pour les url_click on stocke par
  // redirect_event_id (uuid global) et on lira l'école côté redirect_events.
  type MmKey = string; // `${school}|${event_ns}`
  const mmKeys = new Set<MmKey>();
  for (const r of refRows) {
    if (r.step_type === "mm_event" && r.event_ns) {
      const sch = isEdh ? r.event_school_slug : dashSchool;
      if (sch) mmKeys.add(`${sch}|${r.event_ns}`);
    }
  }
  const mmKeyList = Array.from(mmKeys);
  const redirectIdList = Array.from(
    new Set(
      refRows
        .filter((r) => r.step_type === "url_click")
        .map((r) => r.redirect_event_id!)
    )
  );

  // Préchargement des labels :
  //  - mm_events filtré par couples (school_slug, event_ns) : Supabase
  //    n'a pas de WHERE composé (a,b) IN ((..,..)) donc on charge en
  //    bloc par les écoles concernées et on filtre côté JS.
  const involvedSchools = Array.from(
    new Set(mmKeyList.map((k) => k.split("|")[0]!))
  );
  const [mmLabelsRes, redirectLabelsRes] = await Promise.all([
    involvedSchools.length > 0
      ? sb
          .from("mm_events")
          .select("school_slug, event_ns, name")
          .in("school_slug", involvedSchools)
      : Promise.resolve({ data: [], error: null }),
    redirectIdList.length > 0
      ? sb
          .from("redirect_events")
          .select("id, name, school_slug")
          .in("id", redirectIdList)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const mmLabels = new Map<MmKey, string>();
  for (const r of (mmLabelsRes.data as {
    school_slug: string;
    event_ns: string;
    name: string;
  }[]) ?? []) {
    mmLabels.set(`${r.school_slug}|${r.event_ns}`, r.name);
  }
  const redirectLabels = new Map<
    string,
    { name: string; school_slug: string }
  >();
  for (const r of (redirectLabelsRes.data as {
    id: string;
    name: string;
    school_slug: string;
  }[]) ?? []) {
    // En mode école-précise, on n'expose que les redirects de l'école
    // courante (les autres écoles peuvent partager le même uuid en
    // théorie, mais c'est un uuid donc unique : juste un garde-fou).
    if (isEdh || r.school_slug === dashSchool) {
      redirectLabels.set(r.id, { name: r.name, school_slug: r.school_slug });
    }
  }

  const refsByStep = new Map<string, RefRow[]>();
  for (const r of refRows) {
    const arr = refsByStep.get(r.step_id) ?? [];
    arr.push(r);
    refsByStep.set(r.step_id, arr);
  }

  function chipLabel(name: string, schoolSlug: string | null): string {
    if (!isEdh || !schoolSlug) return name;
    const sch = getSchoolBySlug(schoolSlug);
    return `${sch?.name ?? schoolSlug} · ${name}`;
  }

  async function computeRef(r: RefRow): Promise<ComputedRef> {
    if (r.step_type === "mm_event") {
      const evNs = r.event_ns!;
      const refSchool = isEdh ? r.event_school_slug : dashSchool;
      const key = refSchool ? `${refSchool}|${evNs}` : null;
      const available = !!(key && mmLabels.has(key));
      if (!available || !refSchool) {
        return {
          step_type: "mm_event",
          ref_id: evNs,
          label: "(indisponible)",
          count: 0,
          available: false,
          ...(isEdh && refSchool
            ? {
                school_slug: refSchool,
                school_name: getSchoolBySlug(refSchool)?.name ?? refSchool,
              }
            : {}),
        };
      }
      const { count } = await sb
        .from("mm_occurrences")
        .select("*", { count: "exact", head: true })
        .eq("school_slug", refSchool)
        .eq("event_ns", evNs)
        .gte("occurred_at", fromTs)
        .lt("occurred_at", toTs);
      const baseLabel = mmLabels.get(key!)!;
      return {
        step_type: "mm_event",
        ref_id: evNs,
        label: chipLabel(baseLabel, refSchool),
        count: count ?? 0,
        available: true,
        ...(isEdh
          ? {
              school_slug: refSchool,
              school_name: getSchoolBySlug(refSchool)?.name ?? refSchool,
            }
          : {}),
      };
    }
    const reId = r.redirect_event_id!;
    const meta = redirectLabels.get(reId);
    if (!meta) {
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
      label: chipLabel(meta.name, meta.school_slug),
      count: count ?? 0,
      available: true,
      ...(isEdh
        ? {
            school_slug: meta.school_slug,
            school_name:
              getSchoolBySlug(meta.school_slug)?.name ?? meta.school_slug,
          }
        : {}),
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
