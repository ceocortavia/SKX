import "@/lib/src_full/app/globals.css";
import "@/styles/tokens.css";
import "./globals.css";
import type { ReactNode } from "react";
import Topbar from "@/components/marketing/Topbar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="min-h-dvh antialiased text-black/80">
        {/* ÉN global topbar */}
        <Topbar />
        <main className="pt-16 relative z-0">{children}</main>
      </body>
    </html>
  );
}


