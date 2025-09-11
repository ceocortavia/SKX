"use client";

import Link from "next/link";

const nav = [
  { href: "/", label: "Hjem" },
  { href: "/#services", label: "Tjenester" },
  { href: "/#about", label: "Om oss" },
  { href: "/contact", label: "Kontakt" },
  { href: "/docs", label: "Design" },
];

export default function Topbar() {
  return (
    <header className="sticky top-0 z-[100] isolate bg-white/70 supports-[backdrop-filter]:bg-white/60 backdrop-blur border-b border-black/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">Skillexia</Link>
        <nav className="hidden md:flex gap-6 text-sm">
          {nav.map(i => (
            <Link key={i.href} href={i.href} className="hover:opacity-80">
              {i.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

