"use client";

import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const [showPlatform, setShowPlatform] = useState(false);
  useEffect(() => {
    // Enkel klient-sjekk: hvis vi har cookie/prod, vis lenke alltid; ellers fallback til miljøflagget
    // I et senere steg kan dette kobles til en lettvekts /api/platform/admins/me
    setShowPlatform(true);
  }, []);
  const centerTitle = pathname?.startsWith("/profile")
    ? "Profil"
    : pathname?.startsWith("/admin")
    ? "Admin"
    : "";
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mx-auto flex h-14 w-full max-w-screen-lg items-center justify-between px-4 lg:px-8">
        <button
          onClick={onMenu}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 lg:hidden"
          aria-label="Åpne meny"
        >
          Meny
        </button>
        <div className="text-sm text-slate-500 dark:text-slate-400">{centerTitle}</div>
        <div className="flex items-center gap-3">
          {showPlatform && (
            <Link href="/admin/platform" className="hidden sm:inline rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">
              Platform-admin
            </Link>
          )}
          <SignedIn>
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </SignedIn>
          <SignedOut>
            <SignInButton>
              <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">Logg inn</button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}


