"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignedIn, SignedOut, UserButton, useClerk, useUser } from "@clerk/nextjs";

const nav = [
  { href: "/", label: "Hjem" },
  { href: "/#services", label: "Tjenester" },
  { href: "/#about", label: "Om oss" },
  { href: "/contact", label: "Kontakt" },
  { href: "/docs", label: "Design" },
];

export default function Topbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();

  // Små, lesbare del-komponenter for handlinger
  const SignedOutActionsDesktop = () => (
    <SignedOut>
      <Link href="/sign-in" className="text-sm text-black/60 hover:text-black">Logg inn</Link>
      <Link href="/sign-up" className="inline-flex h-9 items-center rounded-xl px-3 text-sm bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white shadow-sm">Registrer</Link>
    </SignedOut>
  );

  const SignedInActionsDesktop = () => (
    <SignedIn>
      <Link href="/profile" className="text-sm text-black/60 hover:text-black">Profil</Link>
      <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
      <button onClick={() => signOut({ redirectUrl: "/" })} className="text-sm text-black/60 hover:text-black">Logg ut</button>
    </SignedIn>
  );

  const SignedOutActionsMobile = () => (
    <SignedOut>
      <Link href="/sign-in" className="text-sm text-black/70">Logg inn</Link>
      <Link href="/sign-up" className="inline-flex h-9 items-center rounded-xl px-3 text-sm bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white">Registrer</Link>
    </SignedOut>
  );

  const SignedInActionsMobile = () => (
    <SignedIn>
      <span className="text-sm text-black/70">Konto</span>
      <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
      <button onClick={() => signOut({ redirectUrl: "/" })} className="text-sm text-black/70">Logg ut</button>
    </SignedIn>
  );

  return (
    <header
      role="navigation"
      className="sticky top-0 z-[100] isolate relative pointer-events-auto bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 border-b border-black/5"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" aria-label="Skillexia" className="font-semibold">
          Skillexia
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm hover:text-black transition ${pathname === href ? "text-black" : "text-black/60"}`}
            >
              {label}
            </Link>
          ))}
          <SignedIn>
            <Link
              href="/admin/platform"
              className={`text-sm hover:text-black transition ${pathname === "/admin/platform" ? "text-black" : "text-black/60"}`}
            >
              Platform-admin
            </Link>
          </SignedIn>
          <SignedOutActionsDesktop />
          <SignedInActionsDesktop />
        </nav>

        {/* Mobile trigger + dropdown anchor */}
        <div className="relative">
          <button
            type="button"
            aria-label="Meny"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-black/70"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            ☰
          </button>

          {open && (
            <div
              id="mobile-menu"
              className="absolute right-0 top-full mt-2 z-[999] w-64 rounded-2xl bg-white/90 backdrop-blur shadow-xl ring-1 ring-black/10 border border-white/20 overflow-hidden"
            >
              <div className="py-2">
                {nav.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-black/80 hover:bg-black/5"
                  >
                    {label}
                  </Link>
                ))}
                <SignedIn>
                  <Link
                    href="/admin/platform"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-black/80 hover:bg-black/5"
                  >
                    Platform-admin
                  </Link>
                </SignedIn>
                <SignedIn>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-black/80 hover:bg-black/5"
                  >
                    Profil
                  </Link>
                </SignedIn>
              </div>
              <div className="px-4 py-3 border-t border-black/5 flex gap-2 items-center justify-between">
                <SignedOutActionsMobile />
                <SignedInActionsMobile />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

