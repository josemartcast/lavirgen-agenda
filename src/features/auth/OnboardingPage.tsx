import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  collection, doc, setDoc, addDoc, Timestamp, updateDoc
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { clientSchema, serviceSchema, ClientFormData, ServiceFormData } from '../../lib/validators';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ScheduleDay } from '../../lib/types';

const WORKSPACE_ID = 'ws_lavirgen';

const DEFAULT_SCHEDULE: ScheduleDay[] = [
  { dayId: 'mon', open: true,  slots: [{ start: '09:00', end: '20:00' }] },
  { dayId: 'tue', open: true,  slots: [{ start: '09:00', end: '20:00' }] },
  { dayId: 'wed', open: true,  slots: [{ start: '09:00', end: '20:00' }] },
  { dayId: 'thu', open: true,  slots: [{ start: '09:00', end: '20:00' }] },
  { dayId: 'fri', open: true,  slots: [{ start: '09:00', end: '20:00' }] },
  { dayId: 'sat', open: true,  slots: [{ start: '09:00', end: '14:00' }] },
  { dayId: 'sun', open: false, slots: [] },
];

const DAY_LABELS: Record<string, string> = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles',
  thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo',
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Service form
  const serviceForm = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: '', durationMin: 60, price: 0, active: true },
  });

  // Client form
  const clientForm = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', phone: '', notes: '' },
  });

  const toggleDay = (idx: number) => {
    setSchedule((prev) => prev.map((d, i) => i === idx ? { ...d, open: !d.open } : d));
  };

  const updateSlot = (dayIdx: number, slotIdx: number, field: 'start' | 'end', val: string) => {
    setSchedule((prev) => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const slots = [...(d.slots ?? [])];
      slots[slotIdx] = { ...slots[slotIdx], [field]: val };
      return { ...d, slots };
    }));
  };

  const saveSchedule = async () => {
    setSaving(true);
    setError('');
    try {
      for (const day of schedule) {
        await setDoc(
          doc(db, 'workspaces', WORKSPACE_ID, 'schedule', day.dayId),
          { ...day, updatedAt: Timestamp.now() }
        );
      }
      setStep(2);
    } catch (e) {
      setError('Error guardando horario. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const saveService = async (data: ServiceFormData) => {
    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'workspaces', WORKSPACE_ID, 'services'), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      setStep(3);
    } catch (e) {
      setError('Error guardando servicio.');
    } finally {
      setSaving(false);
    }
  };

  const saveClient = async (data: ClientFormData) => {
    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'workspaces', WORKSPACE_ID, 'clients'), {
        ...data,
        nameLower: data.name.toLowerCase(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      // Mark onboarding done
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          onboardingDone: true,
        });
      }
      navigate('/agenda');
    } catch (e) {
      setError('Error guardando clienta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-arena p-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl tracking-widest text-carbon">LAVIRGEN</h1>
          <p className="text-gris text-sm mt-1">Configuración inicial</p>
          <div className="flex gap-2 justify-center mt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`w-8 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-terracota' : 'bg-border-subtle'}`} />
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

        {/* PASO 1: Horario */}
        {step === 1 && (
          <div>
            <h2 className="font-serif text-xl text-carbon mb-1">Horario semanal</h2>
            <p className="text-sm text-gris mb-6">Ajusta tu horario de apertura</p>
            <div className="flex flex-col gap-3">
              {schedule.map((day, i) => (
                <div key={day.dayId} className="bg-white rounded-md p-3 border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-carbon">{DAY_LABELS[day.dayId]}</span>
                    <button
                      onClick={() => toggleDay(i)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${day.open ? 'bg-terracota' : 'bg-gris'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${day.open ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {day.open && day.slots?.map((slot, si) => (
                    <div key={si} className="flex gap-2 mt-2 items-center">
                      <input type="time" value={slot.start} onChange={e => updateSlot(i, si, 'start', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                      <span className="text-gris">—</span>
                      <input type="time" value={slot.end} onChange={e => updateSlot(i, si, 'end', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <Button className="w-full mt-6" loading={saving} onClick={saveSchedule}>
              Guardar horario y continuar →
            </Button>
          </div>
        )}

        {/* PASO 2: Servicio */}
        {step === 2 && (
          <form onSubmit={serviceForm.handleSubmit(saveService)} className="flex flex-col gap-4">
            <h2 className="font-serif text-xl text-carbon mb-1">Primer servicio</h2>
            <p className="text-sm text-gris mb-2">Añade el primer servicio que ofreces</p>
            <Input label="Nombre del servicio" placeholder="Ej: Corte y peinado" error={serviceForm.formState.errors.name?.message} {...serviceForm.register('name')} />
            <Input label="Duración (min)" type="number" placeholder="60" error={serviceForm.formState.errors.durationMin?.message} {...serviceForm.register('durationMin', { valueAsNumber: true })} />
            <Input label="Precio (€)" type="number" placeholder="25" error={serviceForm.formState.errors.price?.message} {...serviceForm.register('price', { valueAsNumber: true })} />
            <Button type="submit" className="w-full mt-2" loading={saving}>
              Guardar servicio y continuar →
            </Button>
          </form>
        )}

        {/* PASO 3: Clienta */}
        {step === 3 && (
          <form onSubmit={clientForm.handleSubmit(saveClient)} className="flex flex-col gap-4">
            <h2 className="font-serif text-xl text-carbon mb-1">Primera clienta</h2>
            <p className="text-sm text-gris mb-2">Añade tu primera clienta</p>
            <Input label="Nombre" placeholder="María García" error={clientForm.formState.errors.name?.message} {...clientForm.register('name')} />
            <Input label="Teléfono" type="tel" placeholder="612345678" error={clientForm.formState.errors.phone?.message} {...clientForm.register('phone')} />
            <Input label="Notas (opcional)" placeholder="Alergia al amoniaco..." {...clientForm.register('notes')} />
            <Button type="submit" className="w-full mt-2" loading={saving}>
              Guardar y empezar a usar la agenda →
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
