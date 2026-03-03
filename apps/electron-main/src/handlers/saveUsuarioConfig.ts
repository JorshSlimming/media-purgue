import path from 'path'
import { ActivityLogger } from '../activityLogger'
import { writeJsonAtomic } from '../fsManager'

export async function saveUsuarioConfigHandler(rootPath: string, usuarioConfig: any) {
  if (!rootPath) return { ok: false, error: 'rootPath required' }
  const mpRoot = path.join(rootPath, '.media-purgue')
  const configPath = path.join(mpRoot, 'Config', 'usuario.json')
  const projectRoot = path.resolve(mpRoot, '..')
  const logger = new ActivityLogger(projectRoot)
  try {
    await writeJsonAtomic(configPath, usuarioConfig, logger)
    try { await logger.logEvent('config:saved', { rootPath, config: usuarioConfig }) } catch (_) {}
    return { ok: true }
  } catch (err: any) {
    try { await logger.logError('error:saveUsuarioConfig', err, { rootPath }) } catch (_) {}
    return { ok: false, error: err.message }
  }
}
