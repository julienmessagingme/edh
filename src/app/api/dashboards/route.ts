import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlugChecked } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";

const PostBody = z.object({
  name: z.string().trim().min(1).max(200),
});

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const schoolSlug = await getCurrentSchoolSlugChecked();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("dashboards")
    .select(
      "id, school_slug, created_by, name, type, date_preset, date_from, date_to, created_at, updated_at"
    )
    .eq("created_by", user.userId)
    .eq("school_slug", schoolSlug)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dashboards: data ?? [] });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const schoolSlug = await getCurrentSchoolSlugChecked();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("dashboards")
    .insert({
      school_slug: schoolSlug,
      created_by: user.userId,
      name: parsed.data.name,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}
