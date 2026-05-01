import { Sidebar } from "./sidebar";
import { HeaderTabs } from "./header-tabs";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { SCHOOLS } from "@/lib/schools";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentSlug = await getCurrentSchoolSlug();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Top bar : level-1 nav */}
      <header className="bg-white border-b px-4 py-2 flex items-center">
        <HeaderTabs />
      </header>

      {/* Sidebar (schools) + main content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          schools={SCHOOLS.map((s) => ({ slug: s.slug, name: s.name }))}
          currentSlug={currentSlug}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
