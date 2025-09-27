import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CopilotRedirectPage() {
  redirect("/admin?tab=copilot");
}

