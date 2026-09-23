// Notificaciones globales via CustomEvent. ToastHost las renderiza.
export type NotifyType = 'success' | 'error';

export function notify(msg: string, type: NotifyType = 'success'): void {
  window.dispatchEvent(new CustomEvent('toast', { detail: { msg, type } }));
}

export function notifyError(msg: string): void {
  notify(msg, 'error');
}

export function notifySuccess(msg: string): void {
  notify(msg, 'success');
}
