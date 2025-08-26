import React from 'react';

type CalloutVariant = 'info' | 'warning' | 'error' | 'success';

interface CalloutProps {
  variant?: CalloutVariant;
  message: string;
  className?: string;
}

export function Callout({ variant = 'info', message, className = '' }: CalloutProps) {
  const baseClasses = 'p-3 rounded-md border';
  const variantClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return (
    <div className={classes}>
      {message}
    </div>
  );
}
