import { useEffect, useState } from 'react';
import { Toast } from './Toast';

interface ToastState {
  msg: string;
  type: 'success' | 'error';
}

// Escucha el evento global 'toast' y renderiza la notificacion.
// Montar una unica vez en la raiz de la app.
export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ToastState;
      setToast(detail);
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  if (!toast) return null;
  return (
    <Toast
      message={toast.msg}
      type={toast.type}
      duration={toast.type === 'error' ? 6000 : 3000}
      onClose={() => setToast(null)}
    />
  );
}
