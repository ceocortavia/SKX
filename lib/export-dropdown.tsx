"use client";
import { useState } from 'react';
import { toCSV, downloadCSV } from '@/lib/csv';
import { exportToExcel, makeSheet } from '@/lib/excel';

interface ExportDropdownProps<T extends object> {
  data: T[];
  headers: (keyof T)[];
  filename: string;
  tabName: string;
  disabled?: boolean;
}

export function ExportDropdown<T extends object>({ 
  data, 
  headers, 
  filename, 
  tabName,
  disabled = false 
}: ExportDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (process.env.NEXT_PUBLIC_EXPORTS_ENABLED !== "1") {
    return null;
  }

  const handleCSVExport = () => {
    const csv = toCSV(data, headers);
    downloadCSV(filename, csv);
    setIsOpen(false);
  };

  const handleExcelExport = () => {
    const sheet = makeSheet(data, tabName, headers);
    exportToExcel([sheet], filename.replace('.csv', '.xlsx'));
    setIsOpen(false);
  };

  const handlePDFExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/export/pdf?tab=${tabName.toLowerCase()}&limit=1000`, {
        headers: {
          'x-test-clerk-user-id': process.env.NEXT_PUBLIC_DEV_BYPASS_USER_ID || '',
          'x-test-clerk-email': process.env.NEXT_PUBLIC_DEV_BYPASS_EMAIL || '',
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace('.csv', '.pdf');
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        alert(`PDF export failed: ${error.error}`);
      }
    } catch (error) {
      alert(`PDF export failed: ${error}`);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
      >
        {isExporting ? "🔄 Exporting..." : "📊 Export"}
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border rounded shadow-lg z-10 min-w-32">
          <button
            onClick={handleCSVExport}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-t"
          >
            📄 CSV
          </button>
          <button
            onClick={handleExcelExport}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          >
            📊 Excel
          </button>
          <button
            onClick={handlePDFExport}
            disabled={isExporting}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-b disabled:opacity-50"
          >
            📋 PDF
          </button>
        </div>
      )}
    </div>
  );
}







