"use client";

import { useState } from "react";

type Props = {
  value: string;
  className?: string;
  children?: React.ReactNode;
};

export default function CopyButton({ value, className, children }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onCopy() {
    try {
      setBusy(true);
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={busy}
      className={
        className ??
        "rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
      }
      aria-live="polite"
    >
      {copied ? "Kopiert" : children ?? "Kopier"}
    </button>
  );
}



