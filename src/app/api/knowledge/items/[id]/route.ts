import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/service";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";
import { deleteFromVectorStore, deleteOpenAIFile } from "@/lib/openai-kb";

export const runtime = "nodejs";

/**
 * DELETE removes the item from OpenAI (vector store + file) AND from the
 * DB. Failures on the OpenAI side are logged as warnings but do NOT block
 * the DB delete : we'd rather have a few orphan files in OpenAI than a
 * ghost row in the UI that can never be cleaned. A future cleanup job
 * (todo.md backlog) can reconcile.
 *
 * NB : PATCH for Q&R items lives in Phase 4 (alongside upload-qa) since
 * it needs the file generation helpers and re-upload pipeline.
 */
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
  const schoolSlug = await getCurrentSchoolSlug();
  const sb = getSupabase();

  const { data: item } = await sb
    .from("knowledge_items")
    .select("id, school_slug, vector_store_file_id, openai_file_id")
    .eq("id", id)
    .maybeSingle();

  // 404 (not 403) so we don't leak existence of items in other schools.
  if (!item || item.school_slug !== schoolSlug) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (item.vector_store_file_id) {
    try {
      await deleteFromVectorStore(item.school_slug, item.vector_store_file_id);
    } catch (err) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "knowledge_item_delete: vector_store delete failed",
          item_id: id,
          err: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
  if (item.openai_file_id) {
    try {
      await deleteOpenAIFile(item.openai_file_id);
    } catch (err) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "knowledge_item_delete: openai_file delete failed",
          item_id: id,
          err: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  const { error } = await sb.from("knowledge_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(
    JSON.stringify({
      level: "info",
      action: "knowledge_item_delete",
      school: schoolSlug,
      item_id: id,
    })
  );

  return NextResponse.json({ ok: true });
}
