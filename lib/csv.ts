export function toCSV<T extends object>(rows: T[], headers?: (keyof T)[]) {
  if (!rows?.length) return "";
  const cols = headers ?? (Object.keys(rows[0]) as (keyof T)[]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map(c => esc(String(c))).join(",");
  const body = rows.map(r => cols.map(c => esc((r as any)[c])).join(",")).join("\n");
  return [head, body].join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}



