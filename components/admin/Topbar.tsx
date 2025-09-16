"use client";

import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/nextjs";

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mx-auto flex h-14 w-full max-w-screen-lg items-center justify-between px-4 lg:px-8">
        <button
          onClick={onMenu}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 lg:hidden"
          aria-label="Åpne meny"
        >
          Meny
        </button>
        <div className="text-sm text-slate-500 dark:text-slate-400">Admin</div>
        <div className="flex items-center gap-2">
          <SignedIn>
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </SignedIn>
          <SignedOut>
            <SignInButton>
              <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">Logg inn</button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}


