import { createFileRoute } from "@tanstack/react-router";
import { OasisDashboard } from "@/components/oasis-dashboard";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Oasis — Insula ta, viitorul tău" },
    { name: "description", content: "Dashboard Oasis: provocări financiare, economii simulate și un oraș virtual care crește cu fiecare alegere bună." },
    { property: "og:title", content: "Oasis — Insula ta, viitorul tău" },
    { property: "og:description", content: "Construiește o insulă virtuală acceptând provocări de economisire. Prototip financiar demonstrativ." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: OasisDashboard,
});
