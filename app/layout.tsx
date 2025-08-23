import type { Metadata } from "next";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "SKX",
  description: "SKX – Clerk + Next.js App Router",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey && process.env.NODE_ENV === "production") {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in production environment");
  }
  return (
    <ClerkProvider publishableKey={publishableKey || (process.env.NODE_ENV !== "production" ? "pk_test_placeholder" : undefined)}>
      <html lang="en">
        <body>
          <header style={{ display: "flex", gap: 12, padding: 12 }}>
            <SignedOut>
              <SignInButton />
              <SignUpButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}


