// Deteccion de solapes de citas — comportamiento dual online/offline.
//
// Online: consulta el servidor (getDocs) — una cita existente en servidor se
// detecta aunque el dispositivo no la tuviera en cache.
// Offline: la consulta al servidor quedaria colgada, asi que se usa la cache
// local (getDocsFromCache), instantanea y con lo descargado previamente.
// El flag de red lo decide el llamador: navigator.onLine en la app; forzado
// en las pruebas. Este modulo es testeable en Node contra el emulador.

import {
  collection, query, where, Timestamp,
  getDocs, getDocsFromCache,
  type Firestore, type QuerySnapshot,
} from 'firebase/firestore';
import type { Appointment } from './types';

export interface OverlapParams {
  ws: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  durationMin: number;
  excludeId?: string;  // propia cita al editar
}

async function fetchDayDocs(
  db: Firestore,
  params: OverlapParams,
  online: boolean,
): Promise<QuerySnapshot> {
  const dayStart = new Date(`${params.date}T00:00:00`);
  const dayEnd = new Date(`${params.date}T23:59:59`);
  const q = query(
    collection(db, 'workspaces', params.ws, 'appointments'),
    where('startAt', '>=', Timestamp.fromDate(dayStart)),
    where('startAt', '<', Timestamp.fromDate(dayEnd)),
  );
  if (online) {
    try {
      // Comportamiento online aprobado: servidor real.
      return await getDocs(q);
    } catch {
      // Caida de red a mitad: fallback a cache sin bloquear.
      return await getDocsFromCache(q);
    }
  }
  // Alternativa offline: cache local, instantanea.
  return await getDocsFromCache(q);
}

// Devuelve la primera cita que solapa (excluyendo canceladas y la propia),
// o null si no hay solape.
export async function findOverlappingAppointment(
  db: Firestore,
  params: OverlapParams,
  online: boolean,
): Promise<Appointment | null> {
  try {
    const newStart = new Date(`${params.date}T${params.time}`);
    const newEnd = new Date(newStart.getTime() + params.durationMin * 60000);
    const snap = await fetchDayDocs(db, params, online);
    for (const d of snap.docs) {
      if (params.excludeId && d.id === params.excludeId) continue;
      const a = d.data() as Appointment;
      if (a.status === 'cancelada') continue;
      if (a.startAt.toDate() < newEnd && a.endAt.toDate() > newStart) {
        return { ...a, id: d.id };
      }
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}
