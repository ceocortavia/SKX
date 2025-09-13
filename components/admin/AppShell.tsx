"use client";

import { useState } from "react";
import AdminTopbar from "./Topbar";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[260px_1fr]">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-col">
        <AdminTopbar onMenu={() => setOpen((v) => !v)} />
        <div className="mx-auto w-full max-w-screen-lg px-4 py-8 lg:px-8 lg:py-10">
          {children}
        </div>
      </div>
    </div>
  );
}


