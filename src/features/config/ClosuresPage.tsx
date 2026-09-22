import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Closure } from '../../lib/types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { closureSchema, ClosureFormData } from '../../lib/validators';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';

const WORKSPACE_ID = 'ws_lavirgen';

const CLOSURE_LABELS = { vacation: 'Vacaciones', holiday: 'Festivo', punctual: 'Cierre puntual' };

export function ClosuresPage() {
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const ws = workspaceId || WORKSPACE_ID;
  const [closures, setClosures] = useState<Closure[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClosureFormData>({
    resolver: zodResolver(closureSchema),
    defaultValues: { type: 'punctual', startDate: '', endDate: '', label: '' },
  });

  useEffect(() => {
    const q = query(collection(db, 'workspaces', ws, 'closures'), orderBy('startDate'));
    return onSnapshot(q, (snap) =>
      setClosures(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Closure)))
    );
  }, [ws]);

  const addClosure = async (data: ClosureFormData) => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'workspaces', ws, 'closures'), {
        ...data,
        createdAt: Timestamp.now(),
      });
      reset();
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteClosure = async (id: string) => {
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'workspaces', ws, 'closures', id));
      setDeleteId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-arena min-h-screen">
      <div className="bg-white border-b border-border-subtle px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/configuracion')} className="p-1">
          <ChevronLeft className="w-5 h-5 text-carbon" />
        </button>
        <h1 className="font-serif text-xl text-carbon flex-1">Cierres y festivos</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Añadir
        </Button>
      </div>

      <div className="p-4 flex flex-col gap-2">
        {closures.length === 0 && (
          <p className="text-center text-gris text-sm py-8">Sin cierres registrados</p>
        )}
        {closures.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border border-border-subtle px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-carbon">
                {c.label || CLOSURE_LABELS[c.type]}
              </p>
              <p className="text-xs text-gris">
                {c.startDate}{c.endDate && c.endDate !== c.startDate ? ` → ${c.endDate}` : ''}
              </p>
              <span className="text-xs bg-arena text-gris px-2 py-0.5 rounded-full">{CLOSURE_LABELS[c.type]}</span>
            </div>
            <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-gris hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add form bottom sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl w-full p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border-subtle rounded-full mx-auto mb-4" />
            <h3 className="font-serif text-lg text-carbon mb-4">Nuevo cierre</h3>
            <form onSubmit={handleSubmit(addClosure)} className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-carbon block mb-1">Tipo</label>
                <select
                  {...register('type')}
                  className="w-full border border-border-input rounded-md px-3 py-2.5 text-sm bg-white"
                >
                  <option value="punctual">Cierre puntual</option>
                  <option value="vacation">Vacaciones</option>
                  <option value="holiday">Festivo</option>
                </select>
              </div>
              <Input label="Fecha inicio" type="date" error={errors.startDate?.message} {...register('startDate')} />
              <Input label="Fecha fin (opcional)" type="date" {...register('endDate')} />
              <Input label="Motivo (opcional)" placeholder="Ej: Semana Santa" {...register('label')} />
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="flex-1" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1" loading={saving}>Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <Modal
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Eliminar cierre"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" loading={saving} onClick={() => deleteId && deleteClosure(deleteId)}>Eliminar</Button>
          </>
        }
      >
        <p className="text-sm text-carbon">¿Eliminar este cierre?</p>
      </Modal>
    </div>
  );
}
