import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Client } from '../../lib/types';
import { createClient } from '../../lib/writes';
import { Avatar } from '../../components/ui/Avatar';
import { FAB } from '../../components/ui/FAB';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, ClientFormData } from '../../lib/validators';
import { Search, UserPlus, CloudUpload } from 'lucide-react';

const WORKSPACE_ID = 'ws_lavirgen';

export function ClientsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const ws = workspaceId || WORKSPACE_ID;
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  useEffect(() => {
    let q;
    if (search.trim()) {
      q = query(
        collection(db, 'workspaces', ws, 'clients'),
        where('nameLower', '>=', search.toLowerCase()),
        where('nameLower', '<=', search.toLowerCase() + '\uf8ff'),
        orderBy('nameLower')
      );
    } else {
      q = query(collection(db, 'workspaces', ws, 'clients'), orderBy('nameLower'));
    }
    const unsub = onSnapshot(q, (snap) =>
      setClients(snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        pendingSync: d.metadata.hasPendingWrites,
      } as Client)))
    );
    return unsub;
  }, [ws, search]);

  // Offline-first: NO await — la escritura se aplica en cache local al
  // instante (la lista la muestra con "Pendiente de sincronizar") y se
  // sincroniza al volver la red. Si el servidor la rechaza, writes.ts
  // muestra un toast de error y el cambio se revierte solo.
  const addClient = (data: ClientFormData) => {
    setError('');
    createClient(ws, data);
    reset();
    setShowAdd(false);
  };

  return (
    <div className="bg-arena min-h-screen">
      <div className="bg-white border-b border-border-subtle px-4 py-3 sticky top-0 z-10">
        <h1 className="font-serif text-xl text-carbon mb-3">Clientas</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gris" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border-input bg-arena/50 text-sm focus:outline-none focus:ring-2 focus:ring-terracota/40"
          />
        </div>
      </div>

      <div className="p-4 flex flex-col gap-2">
        {clients.length === 0 && (
          <p className="text-center text-gris text-sm py-8">
            {search ? 'No se encontraron clientas' : 'Aún no hay clientas. Añade la primera.'}
          </p>
        )}
        {clients.map((client, i) => (
          <button
            key={client.id}
            onClick={() => navigate(`/clientes/${client.id}`)}
            className="bg-white rounded-lg px-4 py-3 flex items-center gap-3 border border-border-subtle text-left hover:shadow-sm transition-shadow"
          >
            <Avatar name={client.name} color={i % 2 === 0 ? 'terracota' : 'salvia'} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-carbon truncate">{client.name}</p>
              <p className="text-xs text-gris">{client.phone}</p>
            </div>
            {client.pendingSync && (
              <span className="flex items-center gap-1 text-[10px] text-gris flex-shrink-0">
                <CloudUpload className="w-3.5 h-3.5" /> Pendiente de sincronizar
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => { setError(''); setShowAdd(true); }}
        className="fixed bottom-20 right-4 w-14 h-14 bg-terracota text-white rounded-full shadow-lg flex items-center justify-center z-40"
      >
        <UserPlus className="w-5 h-5" />
      </button>

      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); reset(); }}
        title="Nueva clienta"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowAdd(false); reset(); }}>Cancelar</Button>
            <Button form="add-client-form" type="submit">Guardar</Button>
          </>
        }
      >
        <form id="add-client-form" onSubmit={handleSubmit(addClient)} className="flex flex-col gap-3">
          <Input label="Nombre" placeholder="María García" error={errors.name?.message} {...register('name')} />
          <Input label="Teléfono" type="tel" placeholder="612345678" error={errors.phone?.message} {...register('phone')} />
          <Input label="Notas" placeholder="Alergias, preferencias..." {...register('notes')} />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
