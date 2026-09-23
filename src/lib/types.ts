import { Timestamp } from 'firebase/firestore';

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'staff';
  workspaceId: string;
  onboardingDone: boolean;
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  serviceIds: string[];
  serviceNames: string[];
  startAt: Timestamp;
  durationMin: number;
  endAt: Timestamp;
  status: 'pendiente' | 'realizada' | 'cancelada';
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  nameLower: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  active: boolean;
  order?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Closure {
  id: string;
  type: 'vacation' | 'holiday' | 'punctual' | 'partial';
  startDate: string;        // YYYY-MM-DD
  endDate?: string;         // solo para vacation
  startTime?: string;       // "HH:MM" — solo para partial
  endTime?: string;         // "HH:MM" — solo para partial
  label?: string;
  createdAt: Timestamp;
}

export interface ScheduleSlot {
  start: string;
  end: string;
}

export interface ScheduleDay {
  dayId: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  open: boolean;
  slots?: ScheduleSlot[];
}
