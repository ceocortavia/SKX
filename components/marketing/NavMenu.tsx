"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { label: string; href: string };

export default function NavMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkBase =
    "block px-3 py-2 rounded-md text-sm font-medium hover:bg-neutral-100 transition";

  return (
    <nav className="w-full">
      {/* Desktop */}
      <ul className="hidden md:flex items-center gap-1">
        {items.map((it) => {
          const active =
            it.href === pathname || (it.href !== "/" && pathname?.startsWith(it.href));
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`${linkBase} ${active ? "bg-neutral-200" : "text-neutral-700"}`}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Mobile */}
      <div className="md:hidden">
        <button
          aria-label="Åpne meny"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center rounded-md border px-3 py-2 text-sm"
        >
          ☰ Meny
        </button>
        {open && (
          <ul className="mt-2 rounded-lg border p-2 bg-white shadow-sm">
            {items.map((it) => (
              <li key={it.href} className="mb-1 last:mb-0">
                <Link href={it.href} onClick={() => setOpen(false)} className={`${linkBase} w-full`}>
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

