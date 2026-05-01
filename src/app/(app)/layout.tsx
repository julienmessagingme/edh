import Image from "next/image";
import { Sidebar } from "./sidebar";
import { HeaderTabs } from "./header-tabs";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { SCHOOLS, EDH_GROUP_LOGO } from "@/lib/schools";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentSlug = await getCurrentSchoolSlug();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Top bar : EDH group logo in the top-left corner, level-1 nav
          tabs sit immediately to its right. */}
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
        <HeaderTabs />
      </header>

      {/* Sidebar (schools) + main content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          schools={SCHOOLS.map((s) => ({
            slug: s.slug,
            name: s.name,
            logo: s.logo,
          }))}
          currentSlug={currentSlug}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
