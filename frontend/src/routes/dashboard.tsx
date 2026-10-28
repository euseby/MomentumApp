import { createFileRoute } from "@tanstack/react-router";
import { OasisDashboard } from "@/components/oasis-dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard Oasis — Orașul și economiile tale" },
    { name: "description", content: "Urmărește soldul simulat, acceptă misiunea AI și dezvoltă orașul tău Oasis." },
    { property: "og:title", content: "Dashboard Oasis — Orașul și economiile tale" },
    { property: "og:description", content: "Misiuni financiare și recompense pentru insula ta virtuală, într-o simulare interactivă." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: OasisDashboard,
});