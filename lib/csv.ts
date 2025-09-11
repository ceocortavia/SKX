export function toCSV<T extends object>(data: T[], headers: (keyof T)[]): string {
  const headerRow = headers.join(',');
  const rows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      if (typeof value === 'string') {
        // Add quotes if the string contains a comma
        return value.includes(',') ? `"${value}"` : value;
      }
      return value;
    }).join(',');
  });
  return [headerRow, ...rows].join('\n');
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}