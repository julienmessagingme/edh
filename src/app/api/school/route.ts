import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidSchoolSlug } from "@/lib/schools";
import { SCHOOL_COOKIE_NAME } from "@/lib/schools/context";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";

const Body = z.object({ slug: z.string() });

export async function POST(req: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidSchoolSlug(parsed.data.slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SCHOOL_COOKIE_NAME, parsed.data.slug, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
