"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/", label: "Hjem" },
  { href: "/#services", label: "Tjenester" },
  { href: "/#about", label: "Om oss" },
  { href: "/contact", label: "Kontakt" },
  { href: "/docs", label: "Design" },
  { href: "/profile", label: "Profil" },
];

export default function Topbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          <Link href="/sign-in" className="text-sm text-black/60 hover:text-black">Logg inn</Link>
          <Link href="/sign-up" className="inline-flex h-9 items-center rounded-xl px-3 text-sm bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white shadow-sm">Registrer</Link>
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
              </div>
              <div className="px-4 py-3 border-t border-black/5 flex gap-2">
                <Link href="/sign-in" className="text-sm text-black/70">Logg inn</Link>
                <Link href="/sign-up" className="inline-flex h-9 items-center rounded-xl px-3 text-sm bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white">Registrer</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

