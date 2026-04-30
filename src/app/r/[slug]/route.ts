import { NextResponse } from "next/server";
import { lookupSlug } from "@/lib/redirect/lookup";
import { checkRate } from "@/lib/redirect/rate-limit";
import { getClientIp } from "@/lib/redirect/client-ip";
import { getSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  const ip = getClientIp(req) ?? "unknown";
  if (!checkRate(ip)) {
    return new NextResponse("Trop de requêtes.", { status: 429 });
  }

  let lookup;
  try {
    lookup = await lookupSlug(slug);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "redirect lookup db error",
        slug,
        err: err instanceof Error ? err.message : String(err),
      })
    );
    return new NextResponse("Service indisponible.", { status: 503 });
  }

  if (!lookup) {
    return new NextResponse("Lien introuvable.", { status: 404 });
  }

  const userAgent = req.headers.get("user-agent");
  const referer = req.headers.get("referer");

  // Fire-and-forget click insert (don't block redirect)
  void getSupabase()
    .from("clicks")
    .insert({
      event_id: lookup.eventId,
      version_id: lookup.versionId,
      ip: ip === "unknown" ? null : ip,
      user_agent: userAgent,
      referer,
    })
    .then(({ error }: { error: { message?: string } | null }) => {
      if (error) {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "click insert failed",
            slug,
            err: error.message,
          })
        );
      }
    });

  return NextResponse.redirect(lookup.destinationUrl, { status: 302 });
}
