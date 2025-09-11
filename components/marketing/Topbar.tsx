"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const nav = [
  { href: "/", label: "Hjem" },
  { href: "/#services", label: "Tjenester" },
  { href: "/#about", label: "Om oss" },
  { href: "/contact", label: "Kontakt" },
  { href: "/docs", label: "Design" },
];

export default function Topbar() {
  const pathname = usePathname();
  return (
    <header className="w-full backdrop-blur bg-white/70 border-b border-black/5">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">Skillexia</Link>
        <ul className="flex items-center gap-5 text-sm">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "hover:text-primary transition-colors",
                  pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                    ? "text-primary font-medium"
                    : "text-foreground/70"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

