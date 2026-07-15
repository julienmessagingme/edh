import { GlobalClient } from "./global-client";
import { getCurrentSchoolSlug } from "@/lib/schools/context";

export default async function GlobalPage() {
  // `key` = scope courant → remonte le client au switch d'école (mêmes URLs
  // d'API, le scope vient du cookie ; cf. bug switch d'école Phase 36).
  const schoolSlug = await getCurrentSchoolSlug();
  return <GlobalClient key={schoolSlug} />;
}
