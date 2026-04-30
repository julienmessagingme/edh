import { getCurrentSchoolSlug } from "@/lib/schools/context";
import { getSchoolBySlug } from "@/lib/schools";

export default async function HomePage() {
  const slug = await getCurrentSchoolSlug();
  const school = getSchoolBySlug(slug);
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{school?.name ?? slug}</h2>
      <p className="text-zinc-600">
        Bienvenue. Les onglets « URLs » et « Stats » seront ajoutés dans les prochaines phases.
      </p>
      <div className="text-sm text-zinc-400 mt-8 pt-4 border-t">
        École courante : <code>{slug}</code>
      </div>
    </div>
  );
}
