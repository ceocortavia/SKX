"use client";
import Link from "next/link";

const lexnordEnabled = process.env.NEXT_PUBLIC_LEXNORD_PANEL === "1";

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-20 bg-black/30 lg:hidden ${open ? "block" : "hidden"}`}
        aria-hidden="true"
      />
      <aside
        className={`fixed z-30 h-dvh w-64 border-r border-black/10 bg-white/60 backdrop-blur p-4 transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        role="navigation"
        aria-label="Hovedmeny"
      >
        <div className="mb-6 text-lg font-semibold">Skillexia</div>
        <nav className="flex flex-col gap-1">
          <NavItem href="/profile" label="Profil" />
          <NavItem href="/admin?tab=members" label="Medlemmer" />
          <NavItem href="/admin?tab=invitations" label="Invitasjoner" />
          <NavItem href="/admin?tab=audit" label="Audit" />
          <NavItem href="/admin?tab=analytics" label="Analytics" />
          <NavItem href="/admin?tab=copilot" label="Copilot" />
          {lexnordEnabled ? <NavItem href="/lexnord" label="LexNord" /> : null}
          <NavItem href="/admin/platform" label="Platform-admin" />
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
