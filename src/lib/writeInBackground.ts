// writeInBackground — patron offline-first de escrituras Firestore.
//
// Las escrituras se aplican al instante en la cache local (los onSnapshot las
// reflejan con metadata.hasPendingWrites = true) y la Promise NO resuelve
// hasta que el servidor confirma. Por tanto la UI nunca debe esperarla:
// se lanza y se completa el flujo de inmediato. El catch captura los
// rechazos DEFINITIVOS (permisos, reglas Firestore, validacion de servidor)
// y los notifica — nunca se tragan.
//
// Este modulo no depende de firebase ni de window: es testeable en Node
// contra el emulador con disableNetwork().

const GENERIC_ERROR =
  'No se pudo guardar el cambio definitivamente. El dato se ha revertido. Comprueba permisos e inténtalo de nuevo.';

export function writeInBackground(promise: Promise<unknown>, context: string): Promise<unknown> {
  promise.catch((e) => {
    console.error(`[writeInBackground] ${context}:`, e);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('toast', { detail: { msg: GENERIC_ERROR, type: 'error' } }),
      );
    }
  });
  return promise;
}
