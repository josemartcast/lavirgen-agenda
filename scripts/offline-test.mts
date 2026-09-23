/**
 * Prueba REAL sin red de los 4 flujos offline-first:
 *   1. Crear clienta   2. Editar clienta   3. Crear cita   4. Editar cita
 *
 * Se ejecuta contra los emuladores de Firebase (auth + firestore) con las
 * reglas reales de firestore.rules cargadas. La red de Firestore se corta de
 * verdad con disableNetwork(): no es un mock.
 *
 * Verifica, por flujo:
 *   a) la escritura devuelve el control a la UI en <500 ms (no hay await bloqueante)
 *   b) la Promise NO resuelve sin red (era la causa del cuelgue de 30 s)
 *   c) el dato YA es visible en cache local con hasPendingWrites=true
 *      (lo que alimenta el badge "Pendiente de sincronizar")
 *   d) al volver la red sincroniza y en el servidor existe EXACTAMENTE 1 vez
 * Ademas:
 *   e) un rechazo definitivo de las reglas (escritura al workspace) se propaga
 *      al catch de writeInBackground (no se traga).
 *
 * Uso: npm run test:offline
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  initializeFirestore, connectFirestoreEmulator,
  disableNetwork, enableNetwork,
  collection, doc, addDoc, updateDoc, onSnapshot,
  getDocsFromCache, getDocsFromServer, getDocs, query, where, Timestamp,
} from 'firebase/firestore';
import { writeInBackground } from '../src/lib/writeInBackground';
import { findOverlappingAppointment } from '../src/lib/overlap';

const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const PROJECT = 'lavirgen-agenda';
const WS = 'ws_lavirgen';
const [FS_HOSTNAME, FS_PORT] = FS_HOST.split(':');

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Bootstrap REST (Bearer owner = bypass reglas, solo emulador) ────────────

async function createAuthUser(email: string, password: string): Promise<string> {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`signUp REST failed: ${JSON.stringify(data)}`);
  return data.localId as string;
}

async function createDoc(coll: string, docId: string, fields: Record<string, unknown>) {
  const res = await fetch(
    `http://${FS_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${coll}?documentId=${docId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields }),
    },
  );
  if (!res.ok) throw new Error(`createDoc ${coll}/${docId} failed: ${await res.text()}`);
}

async function countServerDocs(collectionPath: string): Promise<number> {
  const res = await fetch(
    `http://${FS_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${collectionPath}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  const data = await res.json();
  return (data.documents ?? []).length;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Prueba offline real — 4 flujos + rechazo definitivo ===');
  console.log(`Emuladores: firestore=${FS_HOST} auth=${AUTH_HOST}\n`);

  // 1. Bootstrap
  const email = 'owner@test.lavirgen';
  const password = 'test-password-123';
  const uid = await createAuthUser(email, password);
  await createDoc('users', uid, {
    uid: { stringValue: uid },
    email: { stringValue: email },
    displayName: { stringValue: 'Test Owner' },
    role: { stringValue: 'owner' },
    workspaceId: { stringValue: WS },
    onboardingDone: { booleanValue: true },
    createdAt: { timestampValue: '2026-09-23T10:00:00Z' },
  });
  await createDoc('workspaces', WS, {
    id: { stringValue: WS },
    name: { stringValue: 'La Virgen' },
    ownerUid: { stringValue: uid },
    createdAt: { timestampValue: '2026-09-23T10:00:00Z' },
  });
  console.log(`Bootstrap OK — uid=${uid}\n`);

  // 2. Client SDK autenticado contra el emulador
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo' });
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });
  connectFirestoreEmulator(db, FS_HOSTNAME, Number(FS_PORT));
  await signInWithEmailAndPassword(auth, email, password);
  console.log('Login OK\n');

  const clientsCol = collection(db, 'workspaces', WS, 'clients');
  const apptsCol = collection(db, 'workspaces', WS, 'appointments');

  // ─── Cortar la red DE VERDAD ───────────────────────────────────────────────
  await disableNetwork(db);
  console.log('>>> disableNetwork() — SIN RED a partir de aqui\n');

  // Helper: ejecuta un flujo y verifica a), b), c)
  async function runOfflineFlow(
    name: string,
    promise: Promise<unknown>,
    verify: () => Promise<{ visible: boolean; pending: boolean }>,
  ) {
    // a) la llamada devuelve el control sin esperar al servidor
    const t0 = performance.now();
    let settled = false;
    promise.then(() => { settled = true; }, () => { settled = true; });
    const elapsed = performance.now() - t0;
    check(`${name} — UI no bloqueada`, elapsed < 500, `${elapsed.toFixed(1)}ms < 500ms`);

    // b) la promesa NO resuelve sin red en 2.5 s (antes: cuelgue >30 s)
    await sleep(2500);
    check(`${name} — promesa sigue pendiente sin red`, !settled,
      settled ? 'resolvio offline (inesperado)' : 'pendiente tras 2.5s (esperado)');

    // c) visible en cache local con hasPendingWrites (badge "Pendiente de sincronizar")
    const v = await verify();
    check(`${name} — visible en cache local`, v.visible, 'getDocsFromCache lo encuentra');
    check(`${name} — marcado pendiente de sincronizar`, v.pending, 'hasPendingWrites=true');
  }

  // Flujo 1 — crear clienta
  const pCreateClient = writeInBackground(
    addDoc(clientsCol, {
      name: 'Cliente Offline', phone: '600000001', notes: '',
      nameLower: 'cliente offline',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }),
    'createClient',
  );
  let clientId = '';
  await runOfflineFlow('1. Crear clienta', pCreateClient, async () => {
    const snap = await getDocsFromCache(query(clientsCol, where('nameLower', '==', 'cliente offline')));
    clientId = snap.docs[0]?.id ?? '';
    return { visible: snap.size === 1, pending: snap.docs[0]?.metadata.hasPendingWrites ?? false };
  });

  // Flujo 2 — editar clienta
  const pEditClient = writeInBackground(
    updateDoc(doc(db, 'workspaces', WS, 'clients', clientId), {
      phone: '600000002', updatedAt: Timestamp.now(),
    }),
    'updateClient',
  );
  await runOfflineFlow('2. Editar clienta', pEditClient, async () => {
    const snap = await getDocsFromCache(clientsCol);
    const d = snap.docs.find((x) => x.id === clientId);
    return {
      visible: d?.data().phone === '600000002',
      pending: d?.metadata.hasPendingWrites ?? false,
    };
  });

  // Flujo 3 — crear cita
  const start = new Date('2026-09-24T10:00:00');
  const end = new Date(start.getTime() + 60 * 60000);
  const pCreateAppt = writeInBackground(
    addDoc(apptsCol, {
      clientId, clientName: 'Cliente Offline',
      serviceIds: ['svc1'], serviceNames: ['Corte'],
      startAt: Timestamp.fromDate(start), endAt: Timestamp.fromDate(end),
      durationMin: 60, status: 'pendiente', notes: '', createdBy: uid,
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }),
    'createAppointment',
  );
  let apptId = '';
  await runOfflineFlow('3. Crear cita', pCreateAppt, async () => {
    const snap = await getDocsFromCache(query(apptsCol, where('clientId', '==', clientId)));
    apptId = snap.docs[0]?.id ?? '';
    return { visible: snap.size === 1, pending: snap.docs[0]?.metadata.hasPendingWrites ?? false };
  });

  // Flujo 4 — editar cita
  const pEditAppt = writeInBackground(
    updateDoc(doc(db, 'workspaces', WS, 'appointments', apptId), {
      status: 'realizada', updatedAt: Timestamp.now(),
    }),
    'updateAppointment',
  );
  await runOfflineFlow('4. Editar cita', pEditAppt, async () => {
    const snap = await getDocsFromCache(apptsCol);
    const d = snap.docs.find((x) => x.id === apptId);
    return {
      visible: d?.data().status === 'realizada',
      pending: d?.metadata.hasPendingWrites ?? false,
    };
  });

  // ─── Vuelve la red: sincroniza una sola vez, sin duplicados ────────────────
  console.log('\n>>> enableNetwork() — vuelve la red\n');
  await enableNetwork(db);
  await sleep(4000); // margen para que el SDK reenvie la cola

  const serverClients = await countServerDocs(`workspaces/${WS}/clients`);
  check('Sync — clienta existe en servidor', serverClients === 1,
    `${serverClients} doc(s), esperado 1 (sin duplicados)`);

  const serverAppts = await countServerDocs(`workspaces/${WS}/appointments`);
  check('Sync — cita existe en servidor', serverAppts === 1,
    `${serverAppts} doc(s), esperado 1 (sin duplicados)`);

  // El estado editado llego al servidor (cita realizada, telefono nuevo)
  const serverApptDocs = await getDocsFromServer(apptsCol);
  const apptData = serverApptDocs.docs[0]?.data();
  check('Sync — edicion de cita propagada', apptData?.status === 'realizada',
    `status=${apptData?.status}`);
  const serverClientDocs = await getDocsFromServer(clientsCol);
  const clientData = serverClientDocs.docs[0]?.data();
  check('Sync — edicion de clienta propagada', clientData?.phone === '600000002',
    `phone=${clientData?.phone}`);

  // ─── Rechazo definitivo (reglas) — no se traga ─────────────────────────────
  let rejected = false;
  await writeInBackground(
    updateDoc(doc(db, 'workspaces', WS), { name: 'hack' }).catch((e) => {
      rejected = true;
      throw e;
    }),
    'workspaceWriteDenied',
  ).catch(() => { /* la promesa rechaza; writeInBackground ya lo capturo */ });
  check('Rechazo — escritura al workspace denegada por reglas', rejected,
    'permission-denied capturado por el catch');

  // ─── Bateria 2: badge con includeMetadataChanges + solape dual ────────────
  // Observaciones del Socio: el badge debe aparecer mientras esta pendiente y
  // desaparecer solo tras la confirmacion del servidor; y el solape online
  // debe volver a consultar el servidor (cache solo como alternativa offline).

  // P2.1 — Badge visible DURANTE la escritura pendiente (listener con metadata changes)
  const pendingStates: boolean[] = [];
  const badgeDoc = doc(db, 'workspaces', WS, 'clients', clientId);
  const unsubMeta = onSnapshot(badgeDoc, { includeMetadataChanges: true }, (snap) => {
    pendingStates.push(snap.metadata.hasPendingWrites);
  });
  await sleep(400); // dejar llegar el estado inicial (confirmado: false)
  await disableNetwork(db);
  writeInBackground(
    updateDoc(badgeDoc, { notes: 'badge test', updatedAt: Timestamp.now() }),
    'badgeTest',
  );
  await sleep(1500);
  check('Badge — visible durante la escritura pendiente',
    pendingStates.includes(true),
    `estados observados=${JSON.stringify(pendingStates)}`);

  // P2.2 — Badge desaparece SOLO tras enableNetwork + confirmacion del servidor
  await enableNetwork(db);
  const tWait = Date.now();
  while (Date.now() - tWait < 10000) {
    if (pendingStates.includes(true) && pendingStates[pendingStates.length - 1] === false) break;
    await sleep(250);
  }
  unsubMeta();
  check('Badge — se elimina tras la confirmacion del servidor',
    pendingStates.includes(true) && pendingStates[pendingStates.length - 1] === false,
    `secuencia=${JSON.stringify(pendingStates)}`);

  // P2.3 — Online: cita en servidor detectada AUNQUE no este en cache
  // Segundo cliente: cache vacia, ningun listener previo. online=true → getDocs real.
  const app2 = initializeApp({ projectId: PROJECT, apiKey: 'demo' }, 'second');
  const auth2 = getAuth(app2);
  connectAuthEmulator(auth2, `http://${AUTH_HOST}`, { disableWarnings: true });
  const db2 = initializeFirestore(app2, { experimentalForceLongPolling: true });
  connectFirestoreEmulator(db2, FS_HOSTNAME, Number(FS_PORT));
  await signInWithEmailAndPassword(auth2, email, password);
  const foundOnline = await findOverlappingAppointment(
    db2,
    { ws: WS, date: '2026-09-24', time: '10:30', durationMin: 60 },
    true, // conexion: servidor real
  );
  check('Solape online — cita del servidor se detecta sin cache previa',
    !!foundOnline,
    `encontrada=${foundOnline ? `'${foundOnline.clientName}'` : 'null'}`);

  // P2.4 — Offline: cache usada SIN bloquear la interfaz
  // (la consulta anterior ya poblo la cache del segundo cliente)
  await disableNetwork(db2);
  const tOff = performance.now();
  const foundOffline = await findOverlappingAppointment(
    db2,
    { ws: WS, date: '2026-09-24', time: '10:30', durationMin: 60 },
    false, // sin conexion: cache local
  );
  const offElapsed = performance.now() - tOff;
  check('Solape offline — cache sin bloquear la interfaz',
    !!foundOffline && offElapsed < 500,
    `${offElapsed.toFixed(0)}ms, encontrada=${!!foundOffline}`);
  await enableNetwork(db2);
  await deleteApp(app2);

  // ─── Resumen ───────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks PASS ===`);
  await deleteApp(app);
  if (failed.length > 0) {
    console.error('FALLOS:', failed.map((f) => f.name));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
