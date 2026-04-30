import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE_NAME, SessionPayload } from "./session";

export async function requireUser(): Promise<SessionPayload> {
  const c = await cookies();
  const tok = c.get(SESSION_COOKIE_NAME)?.value;
  if (!tok) throw Object.assign(new Error("unauthenticated"), { status: 401 });
  const payload = await verifySession(tok);
  if (!payload) throw Object.assign(new Error("invalid session"), { status: 401 });
  return payload;
}
