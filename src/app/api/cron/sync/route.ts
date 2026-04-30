import { NextResponse } from "next/server";
import { syncAllSchools, syncSchool } from "@/lib/messagingme/sync";
import { getSchoolBySlug, getSchoolToken } from "@/lib/schools";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual trigger via Bearer token. Useful for ad-hoc runs from cURL or for
// the future case of an external scheduler taking over from node-cron.
// The browser UI uses /api/admin/sync (session-auth) instead so that we
// don't have to ship INTERNAL_API_KEY to the client.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.internalApiKey}`) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const url = new URL(req.url);
  const schoolSlug = url.searchParams.get("school");

  if (schoolSlug) {
    const school = getSchoolBySlug(schoolSlug);
    const token = getSchoolToken(schoolSlug);
    if (!school || !token) {
      return NextResponse.json(
        { error: "unknown school or missing token" },
        { status: 400 }
      );
    }
    try {
      await syncSchool(school, token);
      return NextResponse.json({ ok: true, school: schoolSlug });
    } catch (err) {
      return NextResponse.json(
        {
          error: "sync failed",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  }

  const r = await syncAllSchools();
  return NextResponse.json({ success: true, result: r });
}
