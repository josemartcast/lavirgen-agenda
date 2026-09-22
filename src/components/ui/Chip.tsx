import React from 'react';

type ChipColor = 'A' | 'B' | 'C';

interface ChipProps {
  children: React.ReactNode;
  color?: ChipColor;
  className?: string;
  onClick?: () => void;
}

const colorMap: Record<ChipColor, string> = {
  A: 'bg-rosa-palido text-carbon',
  B: 'bg-terracota-claro text-terracota',
  C: 'bg-salvia-claro text-salvia',
};

export function Chip({ children, color = 'A', className = '', onClick }: ChipProps) {
  return (
    <span
      onClick={onClick}
      className={`
        inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
        ${colorMap[color]}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
