import { ActivityLogger } from './activityLogger'

/** One ActivityLogger instance per rootPath so the writeQueue is shared across all IPC calls */
const loggerCache = new Map<string, ActivityLogger>()
function getLogger(rootPath: string): ActivityLogger {
  if (!loggerCache.has(rootPath)) {
    loggerCache.set(rootPath, new ActivityLogger(rootPath))
  }
  return loggerCache.get(rootPath)!
}

export async function appendAppLogHandler(rootPath: string, entry: any) {
  try {
    if (!rootPath) return { ok: false, error: 'rootPath required' }
    const logger = getLogger(rootPath)
    const type = entry?.type || 'app:entry'
    const data = entry?.data ?? entry
    await logger.logEvent(type, data)
    return { ok: true }
  } catch (err: any) {
    try {
      if (rootPath) await getLogger(rootPath).logError('error:ipc:appendAppLog', err, { entry })
    } catch (_) {}
    return { ok: false, error: err.message }
  }
}

export async function readAppLogHandler(rootPath: string, filters?: { types?: string[]; searchText?: string }) {
  try {
    if (!rootPath) return { ok: false, error: 'rootPath required' }
    const logger = getLogger(rootPath)
    let events = await logger.readEvents()

    if (filters?.types && filters.types.length > 0) {
      events = events.filter(e => filters.types!.includes(e.type))
    }

    if (filters?.searchText) {
      const search = filters.searchText.toLowerCase()
      events = events.filter(e => JSON.stringify(e).toLowerCase().includes(search))
    }

    return { ok: true, entries: events }
  } catch (err: any) {
    try {
      if (rootPath) await getLogger(rootPath).logError('error:ipc:readAppLog', err, { filters })
    } catch (_) {}
    return { ok: false, error: err.message }
  }
}

/**
 * Safe wrapper for IPC handler functions that records an ActivityLogger error
 * event when the wrapped function throws.
 */
export async function safeIpcWrapper(rootPath: string, handlerName: string, fn: () => Promise<any>) {
  try {
    return await fn()
  } catch (err: any) {
    try {
      if (rootPath) {
        await getLogger(rootPath).logError(`error:ipc:${handlerName}`, err, {})
      }
    } catch (_) {}
    return { ok: false, error: err?.message || String(err) }
  }
}
