import * as XLSX from 'xlsx';

export interface ExcelSheet {
  name: string;
  data: any[];
  headers?: string[];
}

export function exportToExcel(sheets: ExcelSheet[], filename: string) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  XLSX.writeFile(workbook, filename);
}

export function makeSheet<T extends object>(
  data: T[], 
  name: string, 
  headers?: (keyof T)[]
): ExcelSheet {
  return {
    name,
    data: headers ? data.map(row => {
      const obj: any = {};
      headers.forEach(header => {
        obj[String(header)] = (row as any)[header];
      });
      return obj;
    }) : data,
    headers: headers?.map(h => String(h))
  };
}












