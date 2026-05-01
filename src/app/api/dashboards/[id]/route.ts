import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlugChecked } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import type {
  DashboardWithSteps,
  DashboardStep,
  StepRef,
} from "@/lib/dashboards/types";

export const runtime = "nodejs";

const RefSchema = z.discriminatedUnion("step_type", [
  z.object({
    step_type: z.literal("mm_event"),
    event_ns: z.string().min(1),
  }),
  z.object({
    step_type: z.literal("url_click"),
    redirect_event_id: z.string().uuid(),
  }),
]);

const StepSchema = z.object({
  label: z.string().trim().max(200).nullable().optional(),
  refs: z.array(RefSchema).min(1).max(20),
});

const PatchBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    date_preset: z.enum(["7d", "30d", "90d", "custom"]).optional(),
    date_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    date_to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    steps: z.array(StepSchema).max(50).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "empty patch");

async function findOwned(
  id: string,
  userId: string
): Promise<{ id: string } | null> {
  const sb = getSupabase();
  const schoolSlug = await getCurrentSchoolSlugChecked();
  const { data } = await sb
    .from("dashboards")
    .select("id, created_by, school_slug")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  if (data.created_by !== userId || data.school_slug !== schoolSlug) return null;
  return { id: data.id };
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
  const owned = await findOwned(id, user.userId);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sb = getSupabase();
  const [dashRes, stepsRes] = await Promise.all([
    sb
      .from("dashboards")
      .select(
        "id, school_slug, created_by, name, type, date_preset, date_from, date_to, created_at, updated_at"
      )
      .eq("id", id)
      .single(),
    sb
      .from("dashboard_steps")
      .select("id, position, label")
      .eq("dashboard_id", id)
      .order("position", { ascending: true }),
  ]);
  if (dashRes.error)
    return NextResponse.json({ error: dashRes.error.message }, { status: 500 });
  if (stepsRes.error)
    return NextResponse.json({ error: stepsRes.error.message }, { status: 500 });

  const stepRows = (stepsRes.data ?? []) as Array<{
    id: string;
    position: number;
    label: string | null;
  }>;
  const stepIds = stepRows.map((s) => s.id);

  let refs: StepRef[] = [];
  if (stepIds.length > 0) {
    const { data: refsData, error: refsErr } = await sb
      .from("dashboard_step_refs")
      .select("id, step_id, ref_position, step_type, event_ns, redirect_event_id")
      .in("step_id", stepIds)
      .order("ref_position", { ascending: true });
    if (refsErr)
      return NextResponse.json({ error: refsErr.message }, { status: 500 });
    refs = (refsData ?? []) as unknown as (StepRef & { step_id: string })[];
  }

  const refsByStep = new Map<string, StepRef[]>();
  for (const r of refs as Array<StepRef & { step_id: string }>) {
    const arr = refsByStep.get(r.step_id) ?? [];
    arr.push({
      id: r.id,
      ref_position: r.ref_position,
      step_type: r.step_type,
      event_ns: r.event_ns,
      redirect_event_id: r.redirect_event_id,
    });
    refsByStep.set(r.step_id, arr);
  }

  const steps: DashboardStep[] = stepRows.map((s) => ({
    id: s.id,
    position: s.position,
    label: s.label,
    refs: refsByStep.get(s.id) ?? [],
  }));

  const dashboard: DashboardWithSteps = {
    ...dashRes.data,
    steps,
  };
  return NextResponse.json({ dashboard });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const owned = await findOwned(id, user.userId);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sb = getSupabase();

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) fields.name = parsed.data.name;
  if (parsed.data.date_preset !== undefined)
    fields.date_preset = parsed.data.date_preset;
  if (parsed.data.date_from !== undefined) fields.date_from = parsed.data.date_from;
  if (parsed.data.date_to !== undefined) fields.date_to = parsed.data.date_to;

  if (Object.keys(fields).length > 1) {
    const { error } = await sb.from("dashboards").update(fields).eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.steps !== undefined) {
    // Cascade : delete des steps supprime aussi les refs (FK ON DELETE CASCADE).
    const { error: delErr } = await sb
      .from("dashboard_steps")
      .delete()
      .eq("dashboard_id", id);
    if (delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 });

    for (let i = 0; i < parsed.data.steps.length; i++) {
      const step = parsed.data.steps[i];
      const { data: stepRow, error: stepErr } = await sb
        .from("dashboard_steps")
        .insert({
          dashboard_id: id,
          position: i,
          label: step.label ?? null,
        })
        .select("id")
        .single();
      if (stepErr)
        return NextResponse.json({ error: stepErr.message }, { status: 500 });

      const refRows = step.refs.map((r, ri) => ({
        step_id: stepRow.id,
        ref_position: ri,
        step_type: r.step_type,
        event_ns: r.step_type === "mm_event" ? r.event_ns : null,
        redirect_event_id:
          r.step_type === "url_click" ? r.redirect_event_id : null,
      }));
      const { error: refsErr } = await sb
        .from("dashboard_step_refs")
        .insert(refRows);
      if (refsErr)
        return NextResponse.json({ error: refsErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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
  const owned = await findOwned(id, user.userId);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await getSupabase().from("dashboards").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
