# Agenda La Virgen

PWA de agenda para la peluquería La Virgen. Construida con React + TypeScript + Firebase + Tailwind CSS.

## Requisitos

- Node.js 18+
- npm 9+
- Firebase CLI 13+: `npm install -g firebase-tools`
- git 2.x

## Configuración inicial

### 1. Clonar el repositorio

```bash
git clone https://github.com/josemartcast/lavirgen-agenda.git
cd lavirgen-agenda
```

### 2. Crear `.env.local`

Crea el archivo `.env.local` en la raíz del proyecto con tus credenciales de Firebase:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=lavirgen-agenda.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lavirgen-agenda
VITE_FIREBASE_STORAGE_BUCKET=lavirgen-agenda.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=1:...:web:...
```

> ⚠️ **Nunca commitees `.env.local`**. Ya está en `.gitignore`.

### 3. Instalar dependencias

```bash
npm install
```

### 4. Desarrollo local

```bash
npm run dev
```

La app estará en `http://localhost:5173`.

## Build y deploy

### Build para producción

```bash
npm run build
```

### Deploy preview (NO producción)

```bash
firebase login
firebase hosting:channel:deploy v1-preview --expires 30d
```

### Deploy reglas Firestore

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Bootstrap manual de datos (primera vez)

### Paso 1: Crear usuario en Firebase Auth

1. Firebase Console → Authentication → Users → Añadir usuario (email + contraseña)
2. Copiar el **UID** del usuario creado

### Paso 2: Crear `/users/{uid}`

Colección `users`, documento ID = UID:

```json
{
  "uid": "<UID>",
  "email": "tu@email.com",
  "displayName": "Tu Nombre",
  "role": "owner",
  "workspaceId": "ws_lavirgen",
  "onboardingDone": false,
  "createdAt": "<Timestamp server>"
}
```

### Paso 3: Crear `/workspaces/ws_lavirgen`

Colección `workspaces`, documento ID `ws_lavirgen`:

```json
{
  "name": "La Virgen",
  "ownerUid": "<UID del owner>",
  "createdAt": "<Timestamp server>"
}
```

### Paso 4: Horario inicial (7 documentos en `/workspaces/ws_lavirgen/schedule/`)

| ID   | open  | slots.start | slots.end |
|------|-------|-------------|-----------|
| mon  | true  | 09:00       | 20:00     |
| tue  | true  | 09:00       | 20:00     |
| wed  | true  | 09:00       | 20:00     |
| thu  | true  | 09:00       | 20:00     |
| fri  | true  | 09:00       | 20:00     |
| sat  | true  | 09:00       | 14:00     |
| sun  | false | —           | —         |

> Si `onboardingDone: false`, el onboarding en la app permite configurar todo esto desde la interfaz.

## Stack

- React 18 + TypeScript + Vite
- Firebase: Firestore (offline-first), Auth, Hosting
- Tailwind CSS v3
- React Router DOM + React Hook Form + Zod
- vite-plugin-pwa (PWA/Service Worker)

## Fuera de alcance v1

Novias, notificaciones push, WhatsApp, vista mensual, estadísticas, drag & drop de citas.
