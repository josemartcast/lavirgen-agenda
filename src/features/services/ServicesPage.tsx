import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, Timestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Service } from '../../lib/types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceSchema, ServiceFormData } from '../../lib/validators';
import { Plus, Pencil, Trash2, Scissors } from 'lucide-react';

const WORKSPACE_ID = 'ws_lavirgen';

export function ServicesPage() {
  const { workspaceId } = useAuth();
  const ws = workspaceId || WORKSPACE_ID;
  const [services, setServices] = useState<Service[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: '', durationMin: 60, price: 0, active: true },
  });

  useEffect(() => {
    const q = query(
      collection(db, 'workspaces', ws, 'services'),
      orderBy('name')
    );
    return onSnapshot(q, (snap) =>
      setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Service)))
    );
  }, [ws]);

  const openAdd = () => { setEditingId(null); setError(''); reset(); setShowSheet(true); };
  const openEdit = (svc: Service) => {
    setEditingId(svc.id);
    setError('');
    setValue('name', svc.name);
    setValue('durationMin', svc.durationMin);
    setValue('price', svc.price);
    setValue('active', svc.active);
    setShowSheet(true);
  };

  const saveService = async (data: ServiceFormData) => {
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateDoc(doc(db, 'workspaces', ws, 'services', editingId), {
          ...data, updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'workspaces', ws, 'services'), {
          ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
        });
      }
      setShowSheet(false);
      reset();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const deleteService = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'workspaces', ws, 'services', id));
      setShowDelete(null);
    } catch (e) {
      console.error(e);
      setError('No se pudo eliminar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-arena min-h-screen">
      <div className="bg-white border-b border-border-subtle px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-serif text-xl text-carbon">Servicios</h1>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Añadir
        </Button>
      </div>

      <div className="p-4 flex flex-col gap-2">
        {services.length === 0 && (
          <div className="text-center py-12">
            <Scissors className="w-10 h-10 text-gris mx-auto mb-3" />
            <p className="text-gris text-sm">Sin servicios. Añade el primero.</p>
          </div>
        )}
        {services.map((svc) => (
          <div key={svc.id} className={`bg-white rounded-lg px-4 py-3 border border-border-subtle flex items-center gap-3 ${!svc.active ? 'opacity-50' : ''}`}>
            <div className="flex-1">
              <p className="font-medium text-sm text-carbon">{svc.name}</p>
              <p className="text-xs text-gris">{svc.durationMin} min · {svc.price}€</p>
            </div>
            <button onClick={() => openEdit(svc)} className="p-1.5 text-gris hover:text-carbon">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => setShowDelete(svc.id)} className="p-1.5 text-gris hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl w-full p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border-subtle rounded-full mx-auto mb-4" />
            <h3 className="font-serif text-lg text-carbon mb-4">{editingId ? 'Editar servicio' : 'Nuevo servicio'}</h3>
            <form onSubmit={handleSubmit(saveService)} className="flex flex-col gap-3">
              <Input label="Nombre" placeholder="Ej: Corte y peinado" error={errors.name?.message} {...register('name')} />
              <Input label="Duración (min)" type="number" error={errors.durationMin?.message} {...register('durationMin', { valueAsNumber: true })} />
              <Input label="Precio (€)" type="number" step="0.01" error={errors.price?.message} {...register('price', { valueAsNumber: true })} />
              <label className="flex items-center gap-2 text-sm text-carbon">
                <input type="checkbox" {...register('active')} className="accent-terracota" />
                Servicio activo
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowSheet(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1" loading={saving}>Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <Modal
        open={Boolean(showDelete)}
        onClose={() => setShowDelete(null)}
        title="Eliminar servicio"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDelete(null)}>Cancelar</Button>
            <Button variant="danger" loading={saving} onClick={() => showDelete && deleteService(showDelete)}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-carbon">¿Eliminar este servicio? Las citas existentes no se verán afectadas.</p>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </Modal>
    </div>
  );
}
