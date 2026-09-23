import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, updateDoc, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, Timestamp
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
import { ChevronLeft, Plus, Pencil, Trash2 } from 'lucide-react';

const WORKSPACE_ID = 'ws_lavirgen';

const CLOSURE_LABELS: Record<Closure['type'], string> = {
  vacation: 'Vacaciones',
  holiday: 'Festivo',
  punctual: 'Cierre puntual',
  partial: 'Bloqueo por horas',
};

export function ClosuresPage() {
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const ws = workspaceId || WORKSPACE_ID;
  const [closures, setClosures] = useState<Closure[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ClosureFormData>({
    resolver: zodResolver(closureSchema),
    defaultValues: { type: 'punctual', startDate: '', endDate: '', startTime: '', endTime: '', label: '' },
  });

  const closureType = watch('type');

  useEffect(() => {
    const q = query(collection(db, 'workspaces', ws, 'closures'), orderBy('startDate'));
    return onSnapshot(q, (snap) =>
      setClosures(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Closure)))
    );
  }, [ws]);

  const openAdd = () => {
    setEditingId(null);
    setFormError('');
    reset({ type: 'punctual', startDate: '', endDate: '', startTime: '', endTime: '', label: '' });
    setShowForm(true);
  };

  const openEdit = (c: Closure) => {
    setEditingId(c.id);
    setFormError('');
    setValue('type', c.type);
    setValue('startDate', c.startDate);
    setValue('endDate', c.endDate ?? '');
    setValue('startTime', c.startTime ?? '');
    setValue('endTime', c.endTime ?? '');
    setValue('label', c.label ?? '');
    setShowForm(true);
  };

  const saveClosure = async (data: ClosureFormData) => {
    setFormError('');
    if (data.type === 'partial') {
      if (!data.startTime || !data.endTime) {
        setFormError('Indica la hora de inicio y de fin del bloqueo.');
        return;
      }
      if (data.startTime >= data.endTime) {
        setFormError('La hora de inicio debe ser anterior a la hora de fin.');
        return;
      }
    }
    const base = {
      type: data.type,
      startDate: data.startDate,
      label: data.label ?? '',
    };
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'workspaces', ws, 'closures', editingId), {
          ...base,
          endDate: data.type === 'vacation' && data.endDate ? data.endDate : deleteField(),
          startTime: data.type === 'partial' ? data.startTime : deleteField(),
          endTime: data.type === 'partial' ? data.endTime : deleteField(),
        });
      } else {
        await addDoc(collection(db, 'workspaces', ws, 'closures'), {
          ...base,
          ...(data.type === 'vacation' && data.endDate ? { endDate: data.endDate } : {}),
          ...(data.type === 'partial' ? { startTime: data.startTime, endTime: data.endTime } : {}),
          createdAt: Timestamp.now(),
        });
      }
      reset();
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      console.error(e);
      setFormError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const deleteClosure = async (id: string) => {
    setSaving(true);
    setFormError('');
    try {
      await deleteDoc(doc(db, 'workspaces', ws, 'closures', id));
      setDeleteId(null);
    } catch (e) {
      console.error(e);
      setFormError('No se pudo eliminar. Comprueba tu conexión e inténtalo de nuevo.');
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
        <Button size="sm" onClick={openAdd}>
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
                {c.type === 'partial' && c.startTime && c.endTime ? ` · ${c.startTime}–${c.endTime}` : ''}
              </p>
              <span className="text-xs bg-arena text-gris px-2 py-0.5 rounded-full">{CLOSURE_LABELS[c.type]}</span>
            </div>
            <button onClick={() => openEdit(c)} className="p-1.5 text-gris hover:text-carbon">
              <Pencil className="w-4 h-4" />
            </button>
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
            <h3 className="font-serif text-lg text-carbon mb-4">{editingId ? 'Editar cierre' : 'Nuevo cierre'}</h3>
            <form onSubmit={handleSubmit(saveClosure)} className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-carbon block mb-1">Tipo</label>
                <select
                  {...register('type')}
                  className="w-full border border-border-input rounded-md px-3 py-2.5 text-sm bg-white"
                >
                  <option value="punctual">Cierre puntual</option>
                  <option value="vacation">Vacaciones</option>
                  <option value="holiday">Festivo</option>
                  <option value="partial">Bloqueo por horas</option>
                </select>
              </div>
              <Input label="Fecha inicio" type="date" error={errors.startDate?.message} {...register('startDate')} />
              {closureType === 'partial' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Hora inicio" type="time" error={errors.startTime?.message} {...register('startTime')} />
                  <Input label="Hora fin" type="time" error={errors.endTime?.message} {...register('endTime')} />
                </div>
              ) : (
                <Input label="Fecha fin (opcional)" type="date" {...register('endDate')} />
              )}
              <Input label="Motivo (opcional)" placeholder="Ej: Semana Santa" {...register('label')} />
              {formError && <p className="text-sm text-red-600">{formError}</p>}
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
        {formError && <p className="text-sm text-red-600 mt-2">{formError}</p>}
      </Modal>
    </div>
  );
}
