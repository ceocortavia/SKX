"use client";
import { useState, useEffect } from 'react';

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
}

export function DebouncedInput({
  value,
  onChange,
  placeholder = "Søk...",
  className = "border px-3 py-1 rounded",
  delay = 200
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange, delay]);

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}



