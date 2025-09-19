"use client";

import { useState } from "react";
import AdminTopbar from "./Topbar";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-[260px_1fr]">
      {/* Subtil bakgrunn som matcher marketing/hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white via-white/70 to-white/50" />
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-col">
        <AdminTopbar onMenu={() => setOpen((v) => !v)} />
        <div className="mx-auto w-full max-w-6xl px-4 py-12 lg:px-8 lg:py-14">
          {children}
        </div>
      </div>
    </div>
  );
}


