import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";

const PatchBody = z.object({
  name: z.string().trim().min(1).max(120),
});

/**
 * Verifies the theme belongs to the current school. Returns the row for
 * convenience or null if not found / not owned.
 */
async function findOwnedTheme(id: string): Promise<{ id: string } | null> {
  const sb = getSupabase();
  const schoolSlug = await getCurrentSchoolSlug();
  const { data } = await sb
    .from("knowledge_themes")
    .select("id, school_slug")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.school_slug !== schoolSlug) return null;
  return { id: data.id };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const owned = await findOwnedTheme(id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await getSupabase()
    .from("knowledge_themes")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "duplicate", message: "Ce nom de thème existe déjà." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const owned = await findOwnedTheme(id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Cascade : the FK on knowledge_subthemes.theme_id is ON DELETE CASCADE,
  // so subthemes go away with the theme. knowledge_items.theme_id is ON
  // DELETE SET NULL, so items keep but lose their theme link.
  const { error } = await getSupabase()
    .from("knowledge_themes")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
