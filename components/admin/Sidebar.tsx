"use client";
import Link from "next/link";

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-20 bg-black/30 lg:hidden ${open ? "block" : "hidden"}`}
        aria-hidden="true"
      />
      <aside
        className={`fixed z-30 h-dvh w-64 border-r border-slate-200 bg-white p-4 transition-transform dark:border-slate-800 dark:bg-slate-950 lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        role="navigation"
        aria-label="Hovedmeny"
      >
        <div className="mb-6 text-lg font-semibold">Skillexia</div>
        <nav className="flex flex-col gap-1">
          <NavItem href="/profile" label="Profil" />
          <NavItem href="/members" label="Medlemmer" />
          <NavItem href="/invitations" label="Invitasjoner" />
          <NavItem href="/audit" label="Audit" />
          <NavItem href="/analytics" label="Analytics" />
        </nav>
      </aside>
    </>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="rounded-lg px-3 py-2 text-[15px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
      href={href}
    >
      {label}
    </Link>
  );
}


