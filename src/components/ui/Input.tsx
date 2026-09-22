import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-carbon">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`
          w-full px-3 py-2.5 rounded-md border bg-white text-carbon text-sm
          placeholder:text-gris transition-colors
          focus:outline-none focus:ring-2 focus:ring-terracota/40 focus:border-terracota
          ${error ? 'border-red-500' : 'border-border-input'}
          ${className}
        `}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
