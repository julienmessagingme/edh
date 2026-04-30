import { UrlsClient } from "./urls-client";
import { env } from "@/lib/env";

export default function UrlsPage() {
  return <UrlsClient publicBaseUrl={env.publicBaseUrl} />;
}
