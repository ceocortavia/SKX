"use client";
import { useState } from 'react';

interface QuickDatesProps {
  onFromChange: (date: string | undefined) => void;
  onToChange: (date: string | undefined) => void;
  fromDate?: string;
  toDate?: string;
}

export function QuickDates({ onFromChange, onToChange, fromDate, toDate }: QuickDatesProps) {
  const [isOpen, setIsOpen] = useState(false);

  const setDateRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    onFromChange(from.toISOString().slice(0, 16));
    onToChange(to.toISOString().slice(0, 16));
    setIsOpen(false);
  };

  const clearDates = () => {
    onFromChange(undefined);
    onToChange(undefined);
    setIsOpen(false);
  };

  if (!fromDate && !toDate) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          📅 Quick dates
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-10 p-2 min-w-32">
            <button
              onClick={() => setDateRange(7)}
              className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
            >
              Siste 7 dager
            </button>
            <button
              onClick={() => setDateRange(30)}
              className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
            >
              Siste 30 dager
            </button>
            <button
              onClick={() => setDateRange(90)}
              className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded"
            >
              Siste 90 dager
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={clearDates}
      className="text-xs text-gray-500 hover:text-gray-700 underline"
    >
      ✕ Tøm datoer
    </button>
  );
}













