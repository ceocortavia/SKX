import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AnalyticsRedirectPage() {
  redirect("/admin?tab=analytics");
}

