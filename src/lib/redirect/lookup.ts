import { getSupabase } from "@/lib/supabase/service";

export interface RedirectLookup {
  eventId: string;
  versionId: string;
  destinationUrl: string;
  schoolSlug: string;
}

const TTL_MS = 60_000;
const cache = new Map<string, { value: RedirectLookup | null; expiresAt: number }>();

export async function lookupSlug(slug: string): Promise<RedirectLookup | null> {
  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const sb = getSupabase();
  const { data: ev } = await sb
    .from("redirect_events")
    .select("id, slug, school_slug")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();

  if (!ev) {
    cache.set(slug, { value: null, expiresAt: Date.now() + TTL_MS });
    return null;
  }

  const { data: ver } = await sb
    .from("redirect_versions")
    .select("id, destination_url, version")
    .eq("event_id", ev.id)
    .is("active_to", null)
    .maybeSingle();

  if (!ver) {
    cache.set(slug, { value: null, expiresAt: Date.now() + TTL_MS });
    return null;
  }

  const value: RedirectLookup = {
    eventId: ev.id,
    versionId: ver.id,
    destinationUrl: ver.destination_url,
    schoolSlug: ev.school_slug,
  };
  cache.set(slug, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function invalidateSlugCache(slug: string) {
  cache.delete(slug);
}
