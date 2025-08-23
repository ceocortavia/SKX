### Init: Clerk + Next.js App Router for SKX

Denne filen dokumenterer nøyaktig hva som ble gjort for å sette opp Clerk i SKX-prosjektet, inkludert alle kodeendringer, kommander som ble kjørt, feilmeldinger som oppstod, og hvordan de ble løst.

## Mål
- Integrere Clerk i Next.js App Router-prosjektet
- Beskytte alle ruter som standard, med eksplisitte public routes
- Opprette auth-sider og en eksempel-beskyttet side
- Sikre at `npm run build` passerer

## Endringer som ble gjort

- Oppdaterte `package.json` med Next/React, scripts og TypeScript devDependencies
- Oppdaterte `.gitignore` for å utelukke `.env*` og `node_modules`
- La til `middleware.ts` i rot for Clerk-middleware
- Opprettet App Router-struktur i `app/` med sider:
  - `app/layout.tsx` (ClerkProvider + header)
  - `app/page.tsx` (offentlig side)
  - `app/(auth)/sign-in/[[...sign-in]]/page.tsx`
  - `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
  - `app/(protected)/dashboard/page.tsx`
  - `app/globals.css`
- La inn fallback for `publishableKey` i `ClerkProvider` for robust bygging uten lokale env-variabler

## Full kildekode etter init

```1:20:/Users/macen/Documents/GitHub/SKX/package.json
{
  "name": "skx",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@clerk/nextjs": "^6.31.3",
    "next": "^15.5.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.7",
    "typescript": "^5.6.3"
  }
}
```

```1:4:/Users/macen/Documents/GitHub/SKX/.gitignore
.vercel
.env*
node_modules
```

```1:26:/Users/macen/Documents/GitHub/SKX/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
```

```1:43:/Users/macen/Documents/GitHub/SKX/app/layout.tsx
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
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder"}>
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
```

```1:12:/Users/macen/Documents/GitHub/SKX/app/page.tsx
export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Velkommen til SKX</h1>
      <p>Denne siden er offentlig (publicRoute).</p>
      <p>Gå til /(protected)/dashboard for å se en beskyttet side.</p>
    </main>
  );
}
```

```1:14:/Users/macen/Documents/GitHub/SKX/app/(auth)/sign-in/[[...sign-in]]/page.tsx
"use client";

import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <SignIn routing="path" path="/sign-in" />
    </main>
  );
}
```

```1:14:/Users/macen/Documents/GitHub/SKX/app/(auth)/sign-up/[[...sign-up]]/page.tsx
"use client";

import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <SignUp routing="path" path="/sign-up" />
    </main>
  );
}
```

```1:19:/Users/macen/Documents/GitHub/SKX/app/(protected)/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main style={{ padding: 24 }}>
      <h2>Dashboard</h2>
      <p>Kun innloggede brukere ser dette. Din userId: {userId}</p>
    </main>
  );
}
```

```1:13:/Users/macen/Documents/GitHub/SKX/app/globals.css
/* Global stilark for SKX */
html, body {
  margin: 0;
  padding: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}

main {
  min-height: 100dvh;
}
```

## Kjørte kommandoer

```bash
npm install --no-audit --no-fund
npm run build
```

Lokalt (hvis du har dev-nøkler tilgjengelig):

```bash
cp .env.dev .env.local
npm run dev
```

## Feil som oppstod og hvordan de ble løst

- Feil 1: TypeScript for `<SignIn />`
  - Symptomer under build:
    ```
    Type error: Type '{ routing: "path"; }' is not assignable to type ... Property 'path' is missing ...

     8 |       <SignIn routing="path" />
       |        ^
    ```
  - Årsak: Når `routing="path"` brukes i App Router, krever Clerk også eksplisitt `path`-prop.
  - Løsning: La til `path="/sign-in"` (og tilsvarende for `<SignUp />`).

- Feil 2: `middleware.ts` – options-signaturen
  - Symptomer under build:
    ```
    Object literal may only specify known properties, and 'publicRoutes' does not exist in type 'ClerkMiddlewareOptions'.
    ```
  - Årsak: Den installerte Clerk-versjonen forventer `clerkMiddleware(handler)`-signaturen (eller callback) og bruker route matchers i stedet for `publicRoutes` direkte i options her.
  - Løsning: Byttet til `createRouteMatcher([...])` og callback-mønsteret:
    - Sjekk public paths via `isPublicRoute(req)`
    - Kall `auth()` og redirect til sign-in hvis ikke innlogget.

- Feil 3: `protect()` finnes ikke
  - Symptomer under build etter første refaktor:
    ```
    Property 'protect' does not exist on type 'SessionAuthWithRedirect<Response>'.
    ```
  - Årsak: API-overflaten for objektet returnert av `auth()` i middleware har ikke `.protect()` med vår versjon av Clerk.
  - Løsning: Bruk `const { userId, redirectToSignIn } = await auth(); if (!userId) return redirectToSignIn();`.

- Feil 4: Manglende `publishableKey` ved prerender av `/dashboard`
  - Symptomer under build:
    ```
    Error: @clerk/clerk-react: Missing publishableKey.
    Export encountered an error on /(protected)/dashboard/page: /dashboard, exiting the build.
    ```
  - Årsak: Build-miljøet manglet `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
  - Tiltak: Forsøkte `cp .env.dev .env.local` (for lokal kjøring). Bygget feilet fortsatt (CI kan mangle filene eller verdier).
  - Endelig løsning: La til en trygg fallback i `ClerkProvider`:
    ```tsx
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder"}>
    ```
    Merk: I prod/preview skal miljøvariablene settes i Vercel/Clerk, fallbacken er kun for robust bygging.

## Verifikasjon

Siste `npm run build` fullførte med suksess. Utsnitt:

```text
✓ Compiled successfully
✓ Generating static pages (5/5)
Route (app)                                 Size  First Load JS
┌ ƒ /                                      127 B         102 kB
├ ƒ /_not-found                            992 B         103 kB
├ ƒ /dashboard                             127 B         102 kB
├ ƒ /sign-in/[[...sign-in]]                297 B         130 kB
└ ƒ /sign-up/[[...sign-up]]                297 B         130 kB
ƒ Middleware                             80.8 kB
```

## Miljøvariabler

Opprett og hold utenfor repo:
- `.env.dev` (lokalt):
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test...`
  - `CLERK_SECRET_KEY=sk_test...`
- `.env.preview` (Vercel Preview): `pk_live...`/`sk_live...`
- `.env.prod` (Vercel Prod): `pk_live...`/`sk_live...`

Lokalt:
```bash
cp .env.dev .env.local
```

## Neste steg

Koble Clerk → Supabase med session token i Supabase-klienten, og sett opp migrasjoner + RLS-policyer.



