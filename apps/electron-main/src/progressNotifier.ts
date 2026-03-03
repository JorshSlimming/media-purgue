let notifier: ((payload: any) => void) | null = null

export function setNotifier(fn: (payload: any) => void) {
  notifier = fn
}

export function notifyProgress(payload: any) {
  try {
    if (notifier) notifier(payload)
  } catch (_) {}
}

export default { setNotifier, notifyProgress }
