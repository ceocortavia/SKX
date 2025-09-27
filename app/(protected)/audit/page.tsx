import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AuditRedirectPage() {
  redirect("/admin?tab=audit");
}

