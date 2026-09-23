import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { ScheduleDay } from '../../lib/types';
import { Button } from '../../components/ui/Button';
import { ChevronLeft } from 'lucide-react';

const WORKSPACE_ID = 'ws_lavirgen';

const DAY_LABELS: Record<string, string> = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles',
  thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo',
};

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function SchedulePage() {
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const ws = workspaceId || WORKSPACE_ID;
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'workspaces', ws, 'schedule'),
      (snap) => {
        const data = snap.docs.map((d) => d.data() as ScheduleDay);
        // Sort by day order
        data.sort((a, b) => DAY_ORDER.indexOf(a.dayId) - DAY_ORDER.indexOf(b.dayId));
        setSchedule(data);
      }
    );
    return unsub;
  }, [ws]);

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

  const saveAll = async () => {
    setSaving(true);
    setError('');
    try {
      for (const day of schedule) {
        await setDoc(
          doc(db, 'workspaces', ws, 'schedule', day.dayId),
          { ...day, updatedAt: Timestamp.now() }
        );
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
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
        <h1 className="font-serif text-xl text-carbon">Horario semanal</h1>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {schedule.map((day, i) => (
          <div key={day.dayId} className="bg-white rounded-lg border border-border-subtle p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-carbon">{DAY_LABELS[day.dayId]}</span>
              <button
                onClick={() => toggleDay(i)}
                className={`relative w-11 h-6 rounded-full transition-colors ${day.open ? 'bg-terracota' : 'bg-gris'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${day.open ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {day.open && day.slots?.map((slot, si) => (
              <div key={si} className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gris w-12">Apertura</span>
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) => updateSlot(i, si, 'start', e.target.value)}
                  className="border border-border-input rounded px-2 py-1 text-sm flex-1"
                />
                <span className="text-gris">—</span>
                <span className="text-xs text-gris w-12">Cierre</span>
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) => updateSlot(i, si, 'end', e.target.value)}
                  className="border border-border-input rounded px-2 py-1 text-sm flex-1"
                />
              </div>
            ))}
            {day.open && !day.slots?.length && (
              <p className="text-xs text-gris mt-1">Sin franjas horarias</p>
            )}
          </div>
        ))}

        {saved && (
          <div className="bg-salvia-claro text-salvia text-sm px-4 py-2 rounded-md text-center">
            ✓ Horario guardado
          </div>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <Button className="w-full mt-2" loading={saving} onClick={saveAll}>
          Guardar horario
        </Button>
      </div>
    </div>
  );
}
