'use client';

import { useEffect, useMemo, useState } from "react";
import { collectIssues, analyzeCsvMapping } from "@/lib/ai/csvMap";

interface MappingState {
  name?: string;
  email?: string;
  role?: string;
}

interface MapResponse {
  mapping: MappingState;
  issues: string[];
  confidenceByField: Record<string, number>;
  sessionId?: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvPreview(text: string, maxRows = 25): { headers: string[]; rows: Array<Record<string, string>> } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    return { headers: [], rows: [] };
  }
  const headers = parseCsvLine(lines[0]);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < Math.min(lines.length, maxRows + 1); i += 1) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

export default function CsvImportAssistant() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<MappingState>({});
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hasData = headers.length > 0 && sampleRows.length > 0;

  useEffect(() => {
    if (!hasData) {
      setIssues([]);
      return;
    }
    const newIssues = collectIssues(mapping, sampleRows);
    setIssues(newIssues);
  }, [mapping, sampleRows, hasData]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const { headers: parsedHeaders, rows } = parseCsvPreview(text);
      if (!parsedHeaders.length) {
        throw new Error("Fant ingen kolonneoverskrifter i filen");
      }
      setFileName(file.name);
      setHeaders(parsedHeaders);
      setSampleRows(rows);

      const res = await fetch("/api/tools/csv-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: parsedHeaders,
          sampleRows: rows,
          fileName: file.name,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Kartlegging feilet");
      }
      const data = (await res.json()) as MapResponse;
      setMapping(data.mapping ?? {});
      setConfidence(data.confidenceByField ?? {});
      setSessionId(data.sessionId ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Ukjent feil");
      setHeaders([]);
      setSampleRows([]);
      setMapping({});
      setConfidence({});
      setSessionId(null);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  function setField(field: keyof MappingState, value: string | undefined) {
    setMapping((prev) => ({ ...prev, [field]: value || undefined }));
  }

  function renderSelect(field: keyof MappingState, label: string) {
    const value = mapping[field] ?? "";
    const conf = confidence[field] ? Math.round(confidence[field] * 100) : null;
    return (
      <label className="flex flex-col gap-1 text-sm" key={field}>
        <span className="text-xs uppercase tracking-wide text-gray-500">{label}{conf !== null ? ` (${conf}%)` : ''}</span>
        <select
          value={value}
          onChange={(e) => setField(field, e.target.value || undefined)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        >
          <option value="">— Ikke valgt —</option>
          {headers.map((header) => (
            <option key={`${field}-${header}`} value={header}>{header}</option>
          ))}
        </select>
      </label>
    );
  }

  const samplePreview = useMemo(() => sampleRows.slice(0, 5), [sampleRows]);

  function runLocalValidation() {
    if (!hasData) return;
    const fallback = analyzeCsvMapping(headers, sampleRows);
    setMessage(
      `Auto-mapping foreslår e-post → ${fallback.mapping.email ?? 'ukjent'}, ` +
      `navn → ${fallback.mapping.name ?? 'ukjent'}, rolle → ${fallback.mapping.role ?? 'ukjent'}`
    );
    setMapping(fallback.mapping);
    setConfidence(fallback.confidenceByField);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold">CSV-import (forhåndssjekk)</h3>
          <p className="text-xs text-gray-500">Last opp CSV for automatisk feltmapping, duplikat- og format-sjekk før import.</p>
        </div>
        <label className="inline-flex items-center rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50 cursor-pointer">
          {loading ? "Laster…" : fileName ? `Bytt fil (${fileName})` : "Velg CSV-fil"}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">{message}</div>
      )}

      {hasData && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {renderSelect('email', 'E-post')}
            {renderSelect('name', 'Navn')}
            {renderSelect('role', 'Rolle')}
          </div>
          {issues.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <div className="font-medium">Foreslåtte forbedringer</div>
              <ul className="list-disc pl-5">
                {issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Ingen åpenbare problemer funnet i prøveuttrekket.
            </div>
          )}
          <div className="text-xs text-gray-500">
            {sessionId ? `Sesjons-ID: ${sessionId}` : 'Sesjon ikke lagret enda.'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={runLocalValidation}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Re-run automapping
            </button>
            <button
              disabled={issues.length > 0}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Import (kommer)
            </button>
          </div>
          {samplePreview.length ? (
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Eksempelrader</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="border-b px-2 py-1 text-left font-medium text-gray-600">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {samplePreview.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-b-0">
                        {headers.map((header) => (
                          <td key={`${idx}-${header}`} className="px-2 py-1 text-gray-700">
                            {row[header] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
