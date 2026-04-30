import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function upsertUser(email: string, name: string, password: string) {
  const password_hash = await bcrypt.hash(password, 10);
  const { error } = await sb.from("users").upsert(
    { email, name, password_hash },
    { onConflict: "email" }
  );
  if (error) throw error;
  console.log(`✓ ${email}`);
}

async function main() {
  const julienPwd = process.env.SEED_JULIEN_PASSWORD;
  const edhEmails = process.env.SEED_EDH_EMAILS;
  const edhPwd = process.env.SEED_EDH_PASSWORD;

  if (!julienPwd) {
    console.error("Set SEED_JULIEN_PASSWORD env var before running");
    process.exit(1);
  }

  await upsertUser("julien@messagingme.fr", "Julien Dumas", julienPwd);

  if (edhEmails && edhPwd) {
    const emails = edhEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    for (const email of emails) {
      // Derive a display name from the email local-part for nicer UI.
      const localPart = email.split("@")[0] ?? email;
      const name = `EDH (${localPart})`;
      await upsertUser(email, name, edhPwd);
    }
  } else {
    console.warn(
      "⚠ SEED_EDH_EMAILS or SEED_EDH_PASSWORD not set — skipping EDH users"
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
