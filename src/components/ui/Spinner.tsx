import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return <Loader2 className={`animate-spin text-terracota ${sizeMap[size]} ${className}`} />;
}

export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 bg-arena flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <span className="font-serif text-2xl tracking-widest text-terracota">LAVIRGEN</span>
        <Spinner size="lg" />
      </div>
    </div>
  );
}
