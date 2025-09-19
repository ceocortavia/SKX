import type { PropsWithChildren } from "react";

export default function GlassCard({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`rounded-xl border border-black/10 bg-white/70 backdrop-blur shadow-sm ${className}`}>
      {children}
    </div>
  );
}


