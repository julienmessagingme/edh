import Image from "next/image";
import { Sidebar } from "./sidebar";
import { HeaderTabs } from "./header-tabs";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { getCurrentUserSchools } from "@/lib/schools/access";
import { SCHOOLS, EDH_GROUP_LOGO, MESSAGINGME_LOGO } from "@/lib/schools";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabase } from "@/lib/supabase/service";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const sb = getSupabase();
  const { data } = await sb
    .from("users")
    .select("is_admin")
    .eq("id", user.userId)
    .maybeSingle();
  const isAdmin = !!data?.is_admin;

  const allowedSlugs = new Set(await getCurrentUserSchools(user.userId));
  const accessibleSchools = SCHOOLS.filter((s) => allowedSlugs.has(s.slug));
  const currentSlug = await getCurrentSchoolSlug();
  const currentInAllowed = allowedSlugs.has(currentSlug);
  const effectiveCurrentSlug = currentInAllowed
    ? currentSlug
    : accessibleSchools[0]?.slug ?? currentSlug;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="bg-white border-b px-4 py-2 flex items-center gap-6">
        <Image
          src={EDH_GROUP_LOGO}
          alt="EDH"
          width={40}
          height={40}
          className="h-10 w-auto object-contain"
          unoptimized
          priority
        />
        <HeaderTabs isAdmin={isAdmin} />
      </header>

      <div className="flex flex-1 min-h-0">
        <Sidebar
          schools={accessibleSchools.map((s) => ({
            slug: s.slug,
            name: s.name,
            logo: s.logo,
          }))}
          currentSlug={effectiveCurrentSlug}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>

      <footer className="bg-white border-t px-4 py-3 flex items-center justify-center gap-2 text-xs text-zinc-500">
        <span>Propulsé par</span>
        <Image
          src={MESSAGINGME_LOGO}
          alt="MessagingMe"
          width={120}
          height={24}
          className="h-5 w-auto object-contain"
          unoptimized
        />
      </footer>
    </div>
  );
}
