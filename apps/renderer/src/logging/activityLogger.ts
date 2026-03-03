import { useCallback } from 'react'
import { appendAppLog, readAppLog } from '../ipc'

export async function logEvent(mpRoot: string, type: string, data?: Record<string, any>) {
  if (!mpRoot) return
  try {
    await appendAppLog(mpRoot, { type, data })
  } catch (err) {
    // swallow errors in renderer to avoid breaking UI
    console.error('Failed to log event', err)
  }
}

export async function logError(mpRoot: string, type: string, error: Error, data?: Record<string, any>) {
  if (!mpRoot) return
  try {
    await appendAppLog(mpRoot, { type, data, error: { message: error.message, stack: error.stack } })
  } catch (err) {
    console.error('Failed to log error', err)
  }
}

export async function readEvents(mpRoot: string) {
  if (!mpRoot) return [] as any
  try {
    const res: any = await readAppLog(mpRoot)
    return res?.entries || []
  } catch (err) {
    console.error('readEvents failed', err)
    return []
  }
}

export function useActivityLogger(mpRoot?: string) {
  const logEventCb = useCallback(async (type: string, data?: Record<string, any>) => {
    if (!mpRoot) return
    try { await appendAppLog(mpRoot, { type, data }) } catch (err) { console.error('logEvent failed', err) }
  }, [mpRoot])

  const logErrorCb = useCallback(async (type: string, error: Error, data?: Record<string, any>) => {
    if (!mpRoot) return
    try { await appendAppLog(mpRoot, { type, data, error: { message: error.message, stack: error.stack } }) } catch (err) { console.error('logError failed', err) }
  }, [mpRoot])

  const readEventsCb = useCallback(async () => readEvents(mpRoot || ''), [mpRoot])

  return { logEvent: logEventCb, logError: logErrorCb, readEvents: readEventsCb }
}

export default useActivityLogger
