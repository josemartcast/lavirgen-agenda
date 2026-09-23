import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  query, onSnapshot, Timestamp, getDocs, orderBy, where
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { appointmentSchema, AppointmentFormData } from '../../lib/validators';
import { Appointment, Client, Service, ScheduleDay, Closure } from '../../lib/types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { ChevronLeft, Search } from 'lucide-react';

const WORKSPACE_ID = 'ws_lavirgen';
const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function AppointmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { userDoc, workspaceId, isOwner } = useAuth();
  const ws = workspaceId || WORKSPACE_ID;
  const isEditing = Boolean(id);

  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');
  const [pendingData, setPendingData] = useState<AppointmentFormData | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    register, handleSubmit, control, watch, setValue,
    formState: { errors },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      date: searchParams.get('date') || new Date().toISOString().split('T')[0],
      time: searchParams.get('time') || '09:00',
      serviceIds: [],
      serviceNames: [],
      durationMin: 0,
      status: 'pendiente' as const,
    },
  });

  const selectedServiceIds = watch('serviceIds');
  const selectedDate = watch('date');

  // Load data
  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, 'workspaces', ws, 'clients'), orderBy('nameLower')),
      (snap) => setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)))
    );
    const unsub2 = onSnapshot(
      query(collection(db, 'workspaces', ws, 'services'), where('active', '==', true)),
      (snap) => setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Service)))
    );
    const unsub3 = onSnapshot(
      collection(db, 'workspaces', ws, 'schedule'),
      (snap) => setSchedule(snap.docs.map((d) => d.data() as ScheduleDay))
    );
    const unsub4 = onSnapshot(
      collection(db, 'workspaces', ws, 'closures'),
      (snap) => setClosures(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Closure)))
    );
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [ws]);

  // Load appointment for edit
  useEffect(() => {
    if (!isEditing || !id) return;
    getDoc(doc(db, 'workspaces', ws, 'appointments', id)).then((snap) => {
      if (snap.exists()) {
        const a = snap.data() as Appointment;
        const start = a.startAt.toDate();
        setValue('date', start.toISOString().split('T')[0]);
        setValue('time', `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
        setValue('clientId', a.clientId);
        setValue('clientName', a.clientName);
        setValue('serviceIds', a.serviceIds);
        setValue('serviceNames', a.serviceNames);
        setValue('durationMin', a.durationMin);
        setValue('status', a.status);
        setValue('notes', a.notes ?? '');
        setClientSearch(a.clientName);
      }
      setLoading(false);
    });
  }, [id, isEditing, ws, setValue]);

  const toggleService = (svc: Service) => {
    const current = selectedServiceIds || [];
    const currentNames = watch('serviceNames') || [];
    if (current.includes(svc.id)) {
      const newIds = current.filter((x) => x !== svc.id);
      const newNames = currentNames.filter((_, i) => current[i] !== svc.id);
      setValue('serviceIds', newIds);
      setValue('serviceNames', newNames);
      setValue('durationMin', services.filter((s) => newIds.includes(s.id)).reduce((sum, s) => sum + s.durationMin, 0));
    } else {
      const newIds = [...current, svc.id];
      const newNames = [...currentNames, svc.name];
      setValue('serviceIds', newIds);
      setValue('serviceNames', newNames);
      setValue('durationMin', services.filter((s) => newIds.includes(s.id)).reduce((sum, s) => sum + s.durationMin, 0));
    }
  };

  const checkConflicts = (data: AppointmentFormData): string[] => {
    const warnings: string[] = [];
    const dateObj = new Date(`${data.date}T${data.time}`);
    const dayId = DAY_IDS[dateObj.getDay()];
    const daySchedule = schedule.find((s) => s.dayId === dayId);
    if (!daySchedule?.open) warnings.push('Este día está cerrado según el horario.');

    const isClosure = closures.some((c) => {
      if (c.type === 'partial') return false;
      if (c.startDate > data.date) return false;
      if (c.endDate) return c.startDate <= data.date && c.endDate >= data.date;
      return c.startDate === data.date;
    });
    if (isClosure) warnings.push('Este día tiene un cierre especial.');

    // Bloqueos parciales (RN-02): avisar si la cita solapa alguno
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const newStartMin = dateObj.getHours() * 60 + dateObj.getMinutes();
    const newEndMin = newStartMin + data.durationMin;
    for (const c of closures) {
      if (c.type !== 'partial' || c.startDate !== data.date || !c.startTime || !c.endTime) continue;
      if (toMin(c.startTime) < newEndMin && toMin(c.endTime) > newStartMin) {
        warnings.push(
          `Esta cita se solapa con un bloqueo: ${c.label || 'Bloqueo por horas'} (${c.startTime}–${c.endTime}).`
        );
      }
    }
    return warnings;
  };

  const saveAppointment = async (data: AppointmentFormData) => {
    setSaving(true);
    setError('');
    try {
      const startDate = new Date(`${data.date}T${data.time}`);
      const endDate = new Date(startDate.getTime() + data.durationMin * 60000);
      const payload = {
        clientId: data.clientId,
        clientName: data.clientName,
        serviceIds: data.serviceIds,
        serviceNames: data.serviceNames,
        startAt: Timestamp.fromDate(startDate),
        endAt: Timestamp.fromDate(endDate),
        durationMin: data.durationMin,
        status: data.status,
        notes: data.notes ?? '',
        createdBy: userDoc?.uid || '',
        updatedAt: Timestamp.now(),
      };

      if (isEditing && id) {
        await updateDoc(doc(db, 'workspaces', ws, 'appointments', id), payload);
      } else {
        await addDoc(collection(db, 'workspaces', ws, 'appointments'), {
          ...payload,
          createdAt: Timestamp.now(),
        });
      }
      navigate('/agenda');
    } catch (e) {
      setError('Error guardando la cita. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (data: AppointmentFormData) => {
    const warnings = checkConflicts(data);
    if (warnings.length > 0) {
      setWarningMsg(warnings.join(' '));
      setPendingData(data);
      setShowWarning(true);
      return;
    }
    await saveAppointment(data);
  };

  const handleDelete = async () => {
    if (!id) return;
    setSaving(true);
    try {
      if (isOwner) {
        await deleteDoc(doc(db, 'workspaces', ws, 'appointments', id));
      } else {
        await updateDoc(doc(db, 'workspaces', ws, 'appointments', id), {
          status: 'cancelada',
          updatedAt: Timestamp.now(),
        });
      }
      navigate('/agenda');
    } catch {
      setError('Error al eliminar la cita.');
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.nameLower.includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;

  return (
    <div className="bg-arena min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-border-subtle px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-1">
          <ChevronLeft className="w-5 h-5 text-carbon" />
        </button>
        <h1 className="font-serif text-lg text-carbon">{isEditing ? 'Editar cita' : 'Nueva cita'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 flex flex-col gap-4 pb-8">
        {/* Clienta */}
        <div className="relative">
          <label className="text-sm font-medium text-carbon block mb-1">Clienta</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gris" />
            <input
              className="w-full pl-9 pr-3 py-2.5 rounded-md border border-border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-terracota/40"
              placeholder="Buscar clienta..."
              value={clientSearch}
              onChange={(e) => { setClientSearch(e.target.value); setShowClientList(true); }}
              onFocus={() => setShowClientList(true)}
            />
          </div>
          {showClientList && filteredClients.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white rounded-md shadow-lg border border-border-subtle z-20 max-h-48 overflow-y-auto">
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-arena border-b border-border-subtle last:border-0"
                  onClick={() => {
                    setValue('clientId', c.id);
                    setValue('clientName', c.name);
                    setClientSearch(c.name);
                    setShowClientList(false);
                  }}
                >
                  {c.name} <span className="text-gris text-xs">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
          {errors.clientId && <p className="text-xs text-red-600 mt-1">{errors.clientId.message}</p>}
        </div>

        {/* Fecha y Hora */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha" type="date" error={errors.date?.message} {...register('date')} />
          <Input label="Hora" type="time" error={errors.time?.message} {...register('time')} />
        </div>

        {/* Servicios */}
        <div>
          <label className="text-sm font-medium text-carbon block mb-1">Servicios</label>
          <button
            type="button"
            onClick={() => setShowServiceSheet(true)}
            className="w-full border border-border-input rounded-md px-3 py-2.5 text-sm text-left bg-white"
          >
            {selectedServiceIds?.length
              ? watch('serviceNames')?.join(', ')
              : 'Seleccionar servicios...'}
          </button>
          {errors.serviceIds && <p className="text-xs text-red-600 mt-1">{errors.serviceIds.message}</p>}
        </div>

        {/* Duración (auto) */}
        <div className="bg-white rounded-md border border-border-subtle px-3 py-2.5">
          <span className="text-sm text-gris">Duración total: </span>
          <span className="text-sm font-medium text-carbon">{watch('durationMin') || 0} min</span>
        </div>

        {/* Estado */}
        <div>
          <label className="text-sm font-medium text-carbon block mb-2">Estado</label>
          <div className="flex gap-3">
            {(['pendiente', 'realizada', 'cancelada'] as const).map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" value={s} {...register('status')} className="accent-terracota" />
                <span className={`capitalize ${s === 'realizada' ? 'text-salvia' : s === 'cancelada' ? 'text-red-500' : 'text-carbon'}`}>{s}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="text-sm font-medium text-carbon block mb-1">Notas</label>
          <textarea
            {...register('notes')}
            placeholder="Notas adicionales..."
            className="w-full border border-border-input rounded-md px-3 py-2.5 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-terracota/40"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" loading={saving} className="w-full">
          {isEditing ? 'Guardar cambios' : 'Crear cita'}
        </Button>

        {isEditing && (
          <Button
            type="button"
            variant="danger"
            className="w-full"
            onClick={() => setShowDeleteModal(true)}
          >
            {isOwner ? 'Eliminar cita' : 'Cancelar cita'}
          </Button>
        )}
      </form>

      {/* Services bottom sheet */}
      {showServiceSheet && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowServiceSheet(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl w-full max-h-[70vh] overflow-y-auto p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border-subtle rounded-full mx-auto mb-4" />
            <h3 className="font-serif text-lg text-carbon mb-4">Servicios</h3>
            {services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => toggleService(svc)}
                className={`w-full flex items-center justify-between py-3 border-b border-border-subtle last:border-0 ${
                  selectedServiceIds?.includes(svc.id) ? 'text-terracota' : 'text-carbon'
                }`}
              >
                <span className="text-sm font-medium">{svc.name}</span>
                <span className="text-xs text-gris">{svc.durationMin} min · {svc.price}€</span>
                {selectedServiceIds?.includes(svc.id) && <span className="text-terracota ml-2">✓</span>}
              </button>
            ))}
            <Button className="w-full mt-4" onClick={() => setShowServiceSheet(false)}>
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {/* Warning modal */}
      <Modal
        open={showWarning}
        onClose={() => setShowWarning(false)}
        title="Aviso"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowWarning(false)}>Cancelar</Button>
            <Button onClick={() => { setShowWarning(false); if (pendingData) saveAppointment(pendingData); }}>
              Guardar igual
            </Button>
          </>
        }
      >
        <p className="text-sm text-carbon">{warningMsg}</p>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={isOwner ? 'Eliminar cita' : 'Cancelar cita'}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>No</Button>
            <Button variant="danger" loading={saving} onClick={handleDelete}>
              {isOwner ? 'Eliminar' : 'Cancelar cita'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-carbon">
          {isOwner ? '¿Eliminar esta cita definitivamente?' : '¿Marcar esta cita como cancelada?'}
        </p>
      </Modal>
    </div>
  );
}
