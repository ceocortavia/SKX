"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PlatformAdminLink({ className = "" }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/platform/admins", { cache: "no-store" });
        if (!cancelled && res.ok) setVisible(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <Link href="/admin/platform" className={className}>
      Platform-admin
    </Link>
  );
}





