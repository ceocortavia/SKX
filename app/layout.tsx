import "./globals.css";
import { ReactNode } from "react";
import Topbar from "@/components/marketing/Topbar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="no">
      <body className="min-h-dvh bg-gradient-to-b from-white to-[#f4f7fb] text-gray-900">
        <Topbar />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}


