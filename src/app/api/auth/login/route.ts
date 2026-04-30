import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase/service";
import { signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_TTL } from "@/lib/auth/session";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { email, password } = parsed.data;
  const sb = getSupabase();
  const { data: user, error } = await sb
    .from("users")
    .select("id, email, password_hash, name")
    .eq("email", email)
    .maybeSingle();

  if (error || !user) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const token = await signSession({ userId: user.id, email: user.email });
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_COOKIE_TTL,
    path: "/",
  });
  return res;
}
