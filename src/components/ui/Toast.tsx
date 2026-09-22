import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
        ${type === 'success' ? 'bg-salvia text-white' : 'bg-red-600 text-white'}`}
      >
        {type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const show = (msg: string, type: ToastType = 'success') => {
    // Simple global toast via event
    window.dispatchEvent(new CustomEvent('toast', { detail: { msg, type } }));
  };
  return { show };
}
