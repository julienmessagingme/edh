import { Sidebar } from "./sidebar";
import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { SCHOOLS } from "@/lib/schools";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currentSlug = await getCurrentSchoolSlug();
  return (
    <div className="min-h-screen flex">
      <Sidebar
        schools={SCHOOLS.map((s) => ({ slug: s.slug, name: s.name }))}
        currentSlug={currentSlug}
      />
      <main className="flex-1 p-6 bg-zinc-50">{children}</main>
    </div>
  );
}
