import { WifiOff } from 'lucide-react';
import { useOffline } from '../../hooks/useOffline';

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center gap-2 text-sm text-amber-800">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>Sin conexión — los cambios se sincronizarán al volver a conectarte</span>
    </div>
  );
}
