import path from 'path'
import { getActivityLogger } from '../loggerRegistry'
import { writeJsonAtomic } from '../fsManager'
import fs from 'fs'

export async function saveSessionHandler(rootPath: string, session: any) {
  if (!rootPath) return { ok: false, error: 'rootPath required' }
  const mpRoot = path.join(rootPath, '.media-purgue')
  const stateDir = path.join(mpRoot, 'State')
  const sessionPath = path.join(stateDir, 'session.json')
  const projectRoot = path.resolve(mpRoot, '..')
  const logger = getActivityLogger(projectRoot)
  try {
    // ensure directory exists
    try { await fs.promises.mkdir(stateDir, { recursive: true }) } catch (_) {}
    await writeJsonAtomic(sessionPath, session || {}, logger)
    try { await logger.logEvent('session:saved', { rootPath }) } catch (_) {}
    return { ok: true }
  } catch (err: any) {
    try { await logger.logError('error:saveSession', err, { rootPath }) } catch (_) {}
    return { ok: false, error: err.message }
  }
}

export async function loadSessionHandler(rootPath: string) {
  if (!rootPath) return { ok: false, error: 'rootPath required' }
  const mpRoot = path.join(rootPath, '.media-purgue')
  const sessionPath = path.join(mpRoot, 'State', 'session.json')
  const projectRoot = path.resolve(mpRoot, '..')
  const logger = getActivityLogger(projectRoot)
  try {
    const txt = await fs.promises.readFile(sessionPath, 'utf8').catch(() => null)
    if (!txt) return { ok: true, session: null }
    try {
      const parsed = JSON.parse(txt)
      try { await logger.logEvent('session:loaded', { rootPath, hasSession: !!parsed }) } catch (_) {}
      return { ok: true, session: parsed }
    } catch (err) {
      try { await logger.logError('error:loadSession:parse', err as Error, { rootPath }) } catch (_) {}
      return { ok: false, error: 'invalid session file' }
    }
  } catch (err: any) {
    try { await logger.logError('error:loadSession', err, { rootPath }) } catch (_) {}
    return { ok: false, error: err.message }
  }
}
