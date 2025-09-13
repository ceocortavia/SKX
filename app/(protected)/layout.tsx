import type { ReactNode } from "react";
import AppShell from "@/components/admin/AppShell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}


