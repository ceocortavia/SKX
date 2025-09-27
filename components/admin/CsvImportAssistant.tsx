"use client";

import React from "react";

/**
 * CSV Import Assistant – midlertidig deaktivert.
 * Aktiver igjen ved å:
 * 1) lage '@/lib/ai/csvMap' med faktiske funksjoner
 * 2) sette NEXT_PUBLIC_ENABLE_CSV_ASSISTANT=1
 */
const ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_ENABLE_CSV_ASSISTANT === "1";

export default function CsvImportAssistant() {
  if (!ENABLED) return null;
  return (
    <div className="text-sm text-muted-foreground p-3 rounded-lg border">
      CSV Import Assistant er deaktivert i denne builden. Sett
      <code className="mx-1">NEXT_PUBLIC_ENABLE_CSV_ASSISTANT=1</code>
      og implementer <code>@/lib/ai/csvMap</code> for å aktivere.
    </div>
  );
}
