import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export const appointmentSchema = z.object({
  clientId: z.string().min(1, 'Selecciona una clienta'),
  clientName: z.string().min(1),
  serviceIds: z.array(z.string()).min(1, 'Selecciona al menos un servicio'),
  serviceNames: z.array(z.string()),
  date: z.string().min(1, 'Selecciona una fecha'),
  time: z.string().min(1, 'Selecciona una hora'),
  durationMin: z.number().min(1),
  status: z.enum(['pendiente', 'realizada', 'cancelada']),
  notes: z.string().optional(),
});

export const clientSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  phone: z.string().min(1, 'El teléfono es obligatorio'),
  notes: z.string().optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  durationMin: z.number().min(5, 'Mínimo 5 minutos').max(480, 'Máximo 8 horas'),
  price: z.number().min(0, 'El precio no puede ser negativo'),
  active: z.boolean(),
});

export const closureSchema = z.object({
  type: z.enum(['vacation', 'holiday', 'punctual']),
  startDate: z.string().min(1, 'La fecha de inicio es obligatoria'),
  endDate: z.string().optional(),
  label: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type ClientFormData = z.infer<typeof clientSchema>;
export type ServiceFormData = z.infer<typeof serviceSchema>;
export type ClosureFormData = z.infer<typeof closureSchema>;
