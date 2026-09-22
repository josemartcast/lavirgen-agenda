import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { useState } from 'react';
import {
  User, Clock, CalendarOff, UserPlus, LogOut, ChevronRight
} from 'lucide-react';

export function ConfigPage() {
  const navigate = useNavigate();
  const { userDoc, isOwner } = useAuth();
  const [showAddStaff, setShowAddStaff] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="bg-arena min-h-screen">
      <div className="bg-white border-b border-border-subtle px-4 py-3 sticky top-0 z-10">
        <h1 className="font-serif text-xl text-carbon">Configuración</h1>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Cuenta */}
        <div className="bg-white rounded-lg border border-border-subtle overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3">
            <User className="w-5 h-5 text-terracota" />
            <div>
              <p className="font-medium text-sm text-carbon">{userDoc?.displayName || 'Usuario'}</p>
              <p className="text-xs text-gris">{userDoc?.email}</p>
              <span className="text-xs bg-terracota-claro text-terracota px-2 py-0.5 rounded-full">
                {userDoc?.role === 'owner' ? 'Propietaria' : 'Personal'}
              </span>
            </div>
          </div>
        </div>

        {/* Owner-only sections */}
        {isOwner && (
          <>
            <div className="bg-white rounded-lg border border-border-subtle overflow-hidden">
              <button
                onClick={() => navigate('/configuracion/horario')}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-arena/50"
              >
                <Clock className="w-5 h-5 text-terracota" />
                <span className="flex-1 text-sm font-medium text-carbon text-left">Horario semanal</span>
                <ChevronRight className="w-4 h-4 text-gris" />
              </button>
              <div className="h-px bg-border-subtle" />
              <button
                onClick={() => navigate('/configuracion/cierres')}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-arena/50"
              >
                <CalendarOff className="w-5 h-5 text-terracota" />
                <span className="flex-1 text-sm font-medium text-carbon text-left">Cierres y festivos</span>
                <ChevronRight className="w-4 h-4 text-gris" />
              </button>
              <div className="h-px bg-border-subtle" />
              <button
                onClick={() => setShowAddStaff(true)}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-arena/50"
              >
                <UserPlus className="w-5 h-5 text-terracota" />
                <span className="flex-1 text-sm font-medium text-carbon text-left">Añadir empleada</span>
                <ChevronRight className="w-4 h-4 text-gris" />
              </button>
            </div>
          </>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="bg-white rounded-lg border border-border-subtle px-4 py-3.5 flex items-center gap-3 text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Cerrar sesión</span>
        </button>
      </div>

      <Modal
        open={showAddStaff}
        onClose={() => setShowAddStaff(false)}
        title="Añadir empleada"
      >
        <p className="text-sm text-carbon">Para añadir una empleada, llama a Jose Cuñado.</p>
      </Modal>
    </div>
  );
}
