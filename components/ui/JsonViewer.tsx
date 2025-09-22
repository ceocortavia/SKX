"use client";

import React, { useMemo, useState } from "react";
import CopyButton from "@/components/ui/CopyButton";

type JsonViewerProps = {
  data: unknown;
  className?: string;
  /** Maks høyde, f.eks. "60vh" eller "480px" */
  maxHeight?: string;
  /** Hvor mange nivåer som er utvidet som standard */
  defaultExpandedLevel?: number;
};

type ExpandedMap = Record<string, boolean>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getType(value: unknown): "string" | "number" | "boolean" | "null" | "object" | "array" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (isRecord(value)) return "object";
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return t;
  return "object";
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return "";
  }
}

export default function JsonViewer({
  data,
  className = "",
  maxHeight = "60vh",
  defaultExpandedLevel = 1,
}: JsonViewerProps) {
  const [expanded, setExpanded] = useState<ExpandedMap>({});
  const [query, setQuery] = useState("");

  // Bygg starttilstand for utvidelse basert på dybde
  const initialExpandedKeys = useMemo(() => {
    const keys: ExpandedMap = {};
    function walk(node: unknown, path: string, depth: number) {
      if (depth <= defaultExpandedLevel && (Array.isArray(node) || isRecord(node))) {
        keys[path] = true;
        const entries = Array.isArray(node)
          ? (node as unknown[]).map((v, i) => [String(i), v] as const)
          : Object.entries(node as Record<string, unknown>);
        for (const [k, v] of entries) {
          walk(v, path ? `${path}.${k}` : k, depth + 1);
        }
      }
    }
    walk(data, "", 0);
    return keys;
  }, [data, defaultExpandedLevel]);

  // Slå sammen initial og brukerstyrte toggles
  const isExpanded = (key: string) => (expanded[key] ?? initialExpandedKeys[key] ?? false);

  const toggle = (key: string, open?: boolean) =>
    setExpanded((prev) => ({ ...prev, [key]: open ?? !isExpanded(key) }));

  const expandAll = () => {
    const all: ExpandedMap = {};
    function walk(node: unknown, path: string) {
      if (Array.isArray(node) || isRecord(node)) {
        all[path] = true;
        const entries = Array.isArray(node)
          ? (node as unknown[]).map((v, i) => [String(i), v] as const)
          : Object.entries(node as Record<string, unknown>);
        for (const [k, v] of entries) walk(v, path ? `${path}.${k}` : k);
      }
    }
    walk(data, "");
    setExpanded(all);
  };

  const collapseAll = () => setExpanded({});

  const jsonText = useMemo(() => stringify(data), [data]);

  const toolbar = (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk i nøkler/verdier"
          className="w-full sm:w-64 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-white/70 outline-none focus:ring-2 focus:ring-indigo-400/40"
        />
        <button onClick={expandAll} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white hover:bg-white/10">Utvid alle</button>
        <button onClick={collapseAll} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white hover:bg-white/10">Kollaps alle</button>
      </div>
      <div className="flex items-center gap-2">
        <CopyButton value={jsonText} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10">Kopier JSON</CopyButton>
        <a
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
          href={`data:application/json;charset=utf-8,${encodeURIComponent(jsonText)}`}
          download={`data.json`}
        >
          Last ned
        </a>
      </div>
    </div>
  );

  function highlight(text: string): React.ReactNode {
    const q = query.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-yellow-300/40 text-yellow-100">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  }

  function Value({ value }: { value: unknown }) {
    const type = getType(value);
    if (type === "string") return <span className="text-emerald-300">"{highlight(String(value))}"</span>;
    if (type === "number") return <span className="text-sky-300">{String(value)}</span>;
    if (type === "boolean") return <span className="text-violet-300">{String(value)}</span>;
    if (type === "null") return <span className="text-gray-400">null</span>;
    return <span className="text-gray-200">{String(value)}</span>;
  }

  function Node({ node, path }: { node: unknown; path: string }) {
    const type = getType(node);

    if (type === "array") {
      const arr = node as unknown[];
      const open = isExpanded(path);
      return (
        <div className="leading-6">
          <button onClick={() => toggle(path)} className="mr-1 inline-flex items-center justify-center rounded-sm bg-white/10 hover:bg-white/20 text-[10px] w-4 h-4 align-middle">{open ? "−" : "+"}</button>
          <span className="text-gray-400">[{arr.length}]</span>
          {open && (
            <div className="ml-5 border-l border-white/10 pl-3">
              {arr.map((v, i) => (
                <div key={i} className="">
                  <span className="text-gray-400">{i}:</span> <Node node={v} path={path ? `${path}.${i}` : String(i)} />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === "object") {
      const entries = Object.entries(node as Record<string, unknown>);
      const open = isExpanded(path);
      return (
        <div className="leading-6">
          <button onClick={() => toggle(path)} className="mr-1 inline-flex items-center justify-center rounded-sm bg-white/10 hover:bg-white/20 text-[10px] w-4 h-4 align-middle">{open ? "−" : "+"}</button>
          <span className="text-gray-400">{{}.constructor.name === "Object" ? "{" : "{"}</span>
          {open && (
            <div className="ml-5 border-l border-white/10 pl-3">
              {entries.map(([k, v]) => {
                const keyMatch = query && k.toLowerCase().includes(query.toLowerCase());
                const valueStr = typeof v === "string" ? v : "";
                const valMatch = query && valueStr.toLowerCase().includes(query.toLowerCase());
                return (
                  <div key={k} className={keyMatch || valMatch ? "bg-white/5 rounded px-1 -mx-1" : undefined}>
                    <span className="text-amber-200">"{highlight(k)}"</span>
                    <span className="text-gray-400">: </span>
                    <Node node={v} path={path ? `${path}.${k}` : k} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return <Value value={node} />;
  }

  return (
    <div className={className}>
      <div className="rounded-xl bg-[#0B0B0F] text-white ring-1 ring-black/20">
        <div className="border-b border-white/10 p-3">
          {toolbar}
        </div>
        <div className="p-3 font-mono text-[12px] overflow-auto" style={{ maxHeight }}>
          <Node node={data} path="root" />
        </div>
      </div>
    </div>
  );
}


