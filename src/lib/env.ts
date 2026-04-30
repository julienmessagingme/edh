function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  authSecret: required("AUTH_SECRET"),
  internalApiKey: required("INTERNAL_API_KEY"),
  messagingmeBase: process.env.MESSAGINGME_API_BASE ?? "https://ai.messagingme.app/api",
  cronTimezone: process.env.CRON_TIMEZONE ?? "Europe/Paris",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
} as const;
