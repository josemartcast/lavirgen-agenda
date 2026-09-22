import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  doc, getDoc, updateDoc, deleteDoc, onSnapshot,
  collection, query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Client, Appointment } from '../../lib/types';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, ClientFormData } from '../../lib/validators';
import { ChevronLeft, Phone, Plus, Pencil, Trash2 } from 'lucide-react';

const WORKSPACE_ID = 'ws_lavirgen';

export function ClientDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { workspaceId } = useAuth();
  const ws = workspaceId || WORKSPACE_ID;
  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'workspaces', ws, 'clients', id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Client;
        setClient(data);
        reset({ name: data.name, phone: data.phone, notes: data.notes ?? '' });
      }
      setLoading(false);
    });
    return unsub;
  }, [id, ws, reset]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'workspaces', ws, 'appointments'),
      where('clientId', '==', id),
      orderBy('startAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) =>
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)))
    );
    return unsub;
  }, [id, ws]);

  const updateClient = async (data: ClientFormData) => {
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'workspaces', ws, 'clients', id), {
        ...data,
        nameLower: data.name.toLowerCase(),
        updatedAt: Timestamp.now(),
      });
      setShowEdit(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'workspaces', ws, 'clients', id));
      navigate('/clientes');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (!client) return <div className="p-4 text-gris">Clienta no encontrada</div>;

  return (
    <div className="bg-arena min-h-screen">
      <div className="bg-white border-b border-border-subtle px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/clientes')} className="p-1">
          <ChevronLeft className="w-5 h-5 text-carbon" />
        </button>
        <h1 className="font-serif text-lg text-carbon flex-1">{client.name}</h1>
        <button onClick={() => setShowEdit(true)} className="p-1">
          <Pencil className="w-4 h-4 text-gris" />
        </button>
        <button onClick={() => setShowDelete(true)} className="p-1">
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>

      <div className="p-4">
        {/* Client card */}
        <div className="bg-white rounded-lg p-4 border border-border-subtle mb-4 flex items-center gap-4">
          <Avatar name={client.name} size="lg" />
          <div>
            <p className="font-medium text-carbon">{client.name}</p>
            <a href={`tel:${client.phone}`} className="text-terracota text-sm flex items-center gap-1">
              <Phone className="w-3 h-3" /> {client.phone}
            </a>
            {client.notes && <p className="text-xs text-gris mt-1">{client.notes}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/cita/nueva?clientId=${id}`)}>
            <Plus className="w-4 h-4" /> Nueva cita
          </Button>
          <a href={`tel:${client.phone}`} className="flex-1">
            <Button variant="ghost" size="sm" className="w-full border border-border-subtle">
              <Phone className="w-4 h-4" /> Llamar
            </Button>
          </a>
        </div>

        {/* Historial */}
        <h2 className="font-serif text-base text-carbon mb-2">Historial de citas</h2>
        {appointments.length === 0 && (
          <p className="text-sm text-gris text-center py-4">Sin citas registradas</p>
        )}
        {appointments.map((a) => {
          const date = a.startAt.toDate();
          return (
            <button
              key={a.id}
              onClick={() => navigate(`/cita/${a.id}/editar`)}
              className="w-full bg-white rounded-lg p-3 border border-border-subtle mb-2 text-left hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-carbon">
                  {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' '}{date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.status === 'realizada' ? 'bg-salvia-claro text-salvia' :
                  a.status === 'cancelada' ? 'bg-red-100 text-red-600' :
                  'bg-arena text-gris'
                }`}>{a.status}</span>
              </div>
              <p className="text-xs text-gris mt-1">{a.serviceNames?.join(', ')}</p>
            </button>
          );
        })}
      </div>

      {/* Edit modal */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Editar clienta"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button loading={saving} form="edit-client-form" type="submit">Guardar</Button>
          </>
        }
      >
        <form id="edit-client-form" onSubmit={handleSubmit(updateClient)} className="flex flex-col gap-3">
          <Input label="Nombre" error={errors.name?.message} {...register('name')} />
          <Input label="Teléfono" type="tel" error={errors.phone?.message} {...register('phone')} />
          <Input label="Notas" {...register('notes')} />
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Eliminar clienta"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancelar</Button>
            <Button variant="danger" loading={saving} onClick={deleteClient}>Eliminar</Button>
          </>
        }
      >
        <p className="text-sm text-carbon">¿Eliminar a {client.name}? Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
}
