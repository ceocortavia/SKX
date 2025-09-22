"use client";

export const dynamic = "force-dynamic";

import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <SignUp routing="path" path="/sign-up" />
    </main>
  );
}

