import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
  label?: string;
}

export function FAB({ onClick, label = 'Nueva cita' }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-20 right-4 w-14 h-14 bg-terracota text-white rounded-full shadow-lg flex items-center justify-center hover:bg-terracota-hover active:scale-95 transition-all z-40"
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}
