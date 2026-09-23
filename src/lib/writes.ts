// Escrituras Firestore offline-first de la app.
// La logica de fondo vive en writeInBackground.ts (modulo puro, testeable);
// aqui solo se construyen las operaciones concretas de clientas y citas.

import {
  addDoc, updateDoc, collection, doc, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { writeInBackground } from './writeInBackground';
import type { ClientFormData, AppointmentFormData } from './validators';

export { writeInBackground };

// ─── Clientas ────────────────────────────────────────────────────────────────

export function createClient(ws: string, data: ClientFormData): Promise<unknown> {
  const promise = addDoc(collection(db, 'workspaces', ws, 'clients'), {
    ...data,
    nameLower: data.name.toLowerCase(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return writeInBackground(promise, 'createClient');
}

export function updateClient(ws: string, id: string, data: ClientFormData): Promise<unknown> {
  const promise = updateDoc(doc(db, 'workspaces', ws, 'clients', id), {
    ...data,
    nameLower: data.name.toLowerCase(),
    updatedAt: Timestamp.now(),
  });
  return writeInBackground(promise, 'updateClient');
}

// ─── Citas ───────────────────────────────────────────────────────────────────

export interface AppointmentPayload {
  clientId: string;
  clientName: string;
  serviceIds: string[];
  serviceNames: string[];
  startAt: Timestamp;
  endAt: Timestamp;
  durationMin: number;
  status: AppointmentFormData['status'];
  notes: string;
  createdBy: string;
  updatedAt: Timestamp;
}

export function buildAppointmentPayload(
  data: AppointmentFormData,
  createdBy: string,
): AppointmentPayload {
  const startDate = new Date(`${data.date}T${data.time}`);
  const endDate = new Date(startDate.getTime() + data.durationMin * 60000);
  return {
    clientId: data.clientId,
    clientName: data.clientName,
    serviceIds: data.serviceIds,
    serviceNames: data.serviceNames,
    startAt: Timestamp.fromDate(startDate),
    endAt: Timestamp.fromDate(endDate),
    durationMin: data.durationMin,
    status: data.status,
    notes: data.notes ?? '',
    createdBy,
    updatedAt: Timestamp.now(),
  };
}

export function createAppointment(ws: string, payload: AppointmentPayload): Promise<unknown> {
  const promise = addDoc(collection(db, 'workspaces', ws, 'appointments'), {
    ...payload,
    createdAt: Timestamp.now(),
  });
  return writeInBackground(promise, 'createAppointment');
}

export function updateAppointment(
  ws: string,
  id: string,
  payload: AppointmentPayload,
): Promise<unknown> {
  const promise = updateDoc(doc(db, 'workspaces', ws, 'appointments', id), { ...payload });
  return writeInBackground(promise, 'updateAppointment');
}
