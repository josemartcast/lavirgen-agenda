import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, Timestamp,
  orderBy, getDocs
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Appointment, ScheduleDay, Closure } from '../../lib/types';
import { toLocalDateString, addDays } from '../../lib/dateUtils';
import { FAB } from '../../components/ui/FAB';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';

const WORKSPACE_ID = 'ws_lavirgen';
const CHIP_COLORS = ['bg-rosa-palido', 'bg-terracota-claro', 'bg-salvia-claro'];
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// Rejilla adaptable (D7): rango según el horario real, en intervalos de 30 min
function generateSlots(schedule: ScheduleDay[], daySchedule?: ScheduleDay) {
  let startMin: number | null = null;
  let endMin: number | null = null;
  if (daySchedule?.open && daySchedule.slots?.length) {
    // Día abierto: del inicio del primer slot al final del último
    startMin = Math.min(...daySchedule.slots.map((s) => timeToMinutes(s.start)));
    endMin = Math.max(...daySchedule.slots.map((s) => timeToMinutes(s.end)));
  } else {
    // Día cerrado: rango global del horario semanal (para poder forzar cita)
    const openSlots = schedule.filter((d) => d.open).flatMap((d) => d.slots ?? []);
    if (openSlots.length) {
      startMin = Math.min(...openSlots.map((s) => timeToMinutes(s.start)));
      endMin = Math.max(...openSlots.map((s) => timeToMinutes(s.end)));
    }
  }
  if (startMin === null || endMin === null) {
    startMin = 8 * 60;
    endMin = 20 * 60;
  }
  const slots: string[] = [];
  for (let t = startMin; t < endMin; t += 30) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

export function AgendaPage() {
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState('');

  const dateStr = toLocalDateString(currentDate);
  const dayOfWeek = currentDate.getDay();
  const dayId = DAY_IDS[dayOfWeek];
  const daySchedule = schedule.find((s) => s.dayId === dayId);

  const ws = workspaceId || WORKSPACE_ID;

  useEffect(() => {
    const startOfDay = new Date(dateStr + 'T00:00:00');
    const endOfDay = new Date(dateStr + 'T23:59:59');
    const q = query(
      collection(db, 'workspaces', ws, 'appointments'),
      where('startAt', '>=', Timestamp.fromDate(startOfDay)),
      where('startAt', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('startAt')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));
    });
    return unsub;
  }, [dateStr, ws]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'workspaces', ws, 'schedule'),
      (snap) => setSchedule(snap.docs.map((d) => d.data() as ScheduleDay))
    );
    return unsub;
  }, [ws]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'workspaces', ws, 'closures'),
      (snap) => setClosures(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Closure)))
    );
    return unsub;
  }, [ws]);

  const isClosed = !daySchedule?.open;
  const isClosure = closures.some((c) => {
    if (c.type === 'partial') return false;
    if (c.startDate > dateStr) return false;
    if (c.endDate) return c.startDate <= dateStr && c.endDate >= dateStr;
    return c.startDate === dateStr;
  });

  // Bloqueos parciales del día (RN-02)
  const partialBlocks = closures.filter(
    (c) => c.type === 'partial' && c.startDate === dateStr && c.startTime && c.endTime
  );
  const getBlockForSlot = (time: string) =>
    partialBlocks.find((c) => c.startTime! <= time && time < c.endTime!);

  const slots = generateSlots(schedule, daySchedule);

  const getAppointmentForSlot = (time: string) => {
    return appointments.filter((a) => {
      const start = a.startAt.toDate();
      const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      return startTime === time;
    });
  };

  const isInSchedule = (time: string) => {
    if (!daySchedule?.open) return false;
    // Jornada partida (D6): en horario si cae dentro de ALGÚN slot del día
    return (daySchedule.slots ?? []).some((slot) => slot.start <= time && time < slot.end);
  };

  const goDay = (delta: number) => {
    setCurrentDate((d) => addDays(d, delta));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-border-subtle px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="font-serif text-xl tracking-widest text-carbon">LAVIRGEN</span>
        <div className="flex items-center gap-2">
          <button onClick={() => goDay(-1)} className="p-1 rounded hover:bg-arena">
            <ChevronLeft className="w-5 h-5 text-carbon" />
          </button>
          <button
            onClick={() => { setPickerValue(dateStr); setShowDatePicker(true); }}
            className="text-sm font-medium text-carbon min-w-[130px] text-center rounded px-1 hover:bg-arena active:bg-arena"
            title="Elegir fecha"
          >
            {DAY_NAMES[dayOfWeek]}, {currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </button>
          <button onClick={() => goDay(1)} className="p-1 rounded hover:bg-arena">
            <ChevronRight className="w-5 h-5 text-carbon" />
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="text-xs text-terracota font-medium"
        >
          Hoy
        </button>
      </div>

      {/* Closure/closed banner */}
      {(isClosed || isClosure) && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-sm text-amber-700">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>{isClosure ? 'Día cerrado (cierre especial)' : 'Día sin actividad según horario'}</span>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          {slots.map((time) => {
            const slotAppts = getAppointmentForSlot(time);
            const inSchedule = isInSchedule(time);
            const block = getBlockForSlot(time);
            return (
              <div
                key={time}
                className={`flex border-b border-border-subtle min-h-[40px] ${!inSchedule || block ? 'blocked-slot' : 'bg-white'}`}
                onClick={() => {
                  if (slotAppts.length === 0) {
                    navigate(`/cita/nueva?date=${dateStr}&time=${time}`);
                  }
                }}
              >
                <div className="w-14 text-xs text-gris pt-1 px-2 flex-shrink-0 border-r border-border-subtle">
                  {time}
                </div>
                <div className="flex-1 px-1 py-0.5 flex flex-col gap-0.5">
                  {block && (
                    <span className="self-start text-[10px] bg-gris/20 text-gris px-2 py-0.5 rounded-full">
                      Bloqueado{block.label ? `: ${block.label}` : ''}
                    </span>
                  )}
                  {slotAppts.map((appt, idx) => (
                    <button
                      key={appt.id}
                      onClick={(e) => { e.stopPropagation(); navigate(`/cita/${appt.id}/editar`); }}
                      className={`
                        w-full text-left px-2 py-1 rounded text-xs font-medium text-carbon
                        ${CHIP_COLORS[idx % CHIP_COLORS.length]}
                        ${appt.status === 'cancelada' ? 'opacity-50 line-through' : ''}
                        ${appt.status === 'realizada' ? 'opacity-70' : ''}
                      `}
                      style={{ minHeight: `${(appt.durationMin / 30) * 40}px` }}
                    >
                      <span className="truncate block">{appt.clientName}</span>
                      <span className="text-[10px] opacity-70 block truncate">{appt.serviceNames?.join(', ')}</span>
                      {appt.status === 'realizada' && <span className="text-[10px]">✓</span>}
                      {appt.status === 'cancelada' && <span className="text-[10px]">✗</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FAB onClick={() => navigate(`/cita/nueva?date=${dateStr}`)} />

      {/* Date picker modal (RN-01) */}
      <Modal
        open={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title="Ir a fecha"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDatePicker(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (pickerValue) {
                  const [y, m, d] = pickerValue.split('-').map(Number);
                  setCurrentDate(new Date(y, m - 1, d));
                }
                setShowDatePicker(false);
              }}
            >
              Ir
            </Button>
          </>
        }
      >
        <input
          type="date"
          value={pickerValue}
          onChange={(e) => setPickerValue(e.target.value)}
          className="w-full border border-border-input rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-terracota/40"
        />
      </Modal>
    </div>
  );
}
