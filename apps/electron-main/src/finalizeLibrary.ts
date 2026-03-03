import fs from 'fs'
import path from 'path'
import fsExtra from 'fs-extra'
import { readJson } from './fsManager'
import { readLogJSON } from './logger'
import { getActivityLogger } from './loggerRegistry'
import { notifyProgress } from './progressNotifier'

export async function finalizeLibrary(mpRoot: string) {
  const projectRoot = path.resolve(mpRoot, '..')
  const logger = getActivityLogger(projectRoot)
  try { await logger.logEvent('finalize:starting', { mpRoot }) } catch (_) {}
  try { notifyProgress({ type: 'finalize:starting', data: { mpRoot } }) } catch (_) {}
  const logsDir = path.join(mpRoot, 'Logs')
  const logs = await (async () => {
    try { const names = await fs.promises.readdir(logsDir); return names } catch { return [] }
  })()
  const summary: any = { procesos: 0, archivos_procesados: 0, conservados: 0, eliminados: 0, espacio_total_conservado_bytes: 0, espacio_total_liberado_bytes: 0, generado_en: new Date().toISOString() }
  for (const name of logs) {
    if (!name.endsWith('.json')) continue
    const content = await readLogJSON(path.join(logsDir, name))
    if (!content) continue
    summary.procesos = summary.procesos + 1
    summary.conservados += (content.conservados || 0)
    summary.eliminados += (content.eliminados || 0)
    // aggregate archivos procesados if present, otherwise infer
    if (typeof content.archivos_procesados === 'number') summary.archivos_procesados += content.archivos_procesados
    else summary.archivos_procesados += (content.conservados || 0) + (content.eliminados || 0)
    // aggregate bytes stats when available
    summary.espacio_total_conservado_bytes += (content.espacio_conservado_bytes || content.espacio_total_conservado_bytes || 0)
    summary.espacio_total_liberado_bytes += (content.espacio_eliminado_bytes || content.espacio_total_liberado_bytes || 0)
  }

  const configPath = path.join(mpRoot, 'Config', 'usuario.json')
  const usuario = await readJson(configPath)
  const destino = usuario?.ubicacion_biblioteca ? path.resolve(mpRoot, usuario.ubicacion_biblioteca, usuario?.nombre_biblioteca || 'Biblioteca_Final') : path.resolve(mpRoot, '..', usuario?.nombre_biblioteca || 'Biblioteca_Final')
  let moved = false
  try {
    const src = path.join(mpRoot, '02_Biblioteca_Final')
    await fs.promises.mkdir(path.dirname(destino), { recursive: true })
    await fs.promises.rename(src, destino)
    moved = true
    try { notifyProgress({ type: 'finalize:moved', data: { src, destino } }) } catch (_) {}
  } catch (err) {
    try {
      await fsExtra.copy(path.join(mpRoot, '02_Biblioteca_Final'), destino, { overwrite: false })
      moved = true
      try { notifyProgress({ type: 'finalize:copied', data: { src: path.join(mpRoot, '02_Biblioteca_Final'), destino } }) } catch (_) {}
    } catch (err2: any) {
      try { await logger.logError('error:finalizeLibrary', err2, { step: 'copy' }) } catch (_) {}
    }
    try { await logger.logError('error:finalizeLibrary', err as Error, { step: 'rename' }) } catch (_) {}
  }
  try {
    await fs.promises.writeFile(path.join(path.resolve(destino), 'global.json'), JSON.stringify(summary, null, 2), 'utf8')
  } catch (_) {}
  try { await logger.logEvent('finalize:finished', { destino }) } catch (_) {}
  try { notifyProgress({ type: 'finalize:finished', data: { destino, moved } }) } catch (_) {}
  // If destination exists, attempt to remove the .media-purgue folder to free originals
  try {
    const destinoExists = await fs.promises.stat(destino).then(s => !!s).catch(() => false)
    if (destinoExists) {
      // attempt removal with retries and fallback to fs-extra.remove
      async function tryRemove(p: string) {
        let lastErr: any = null
        for (let i = 0; i < 3; i++) {
          try {
            await fs.promises.rm(p, { recursive: true, force: true })
            try { notifyProgress({ type: 'finalize:removed_mpRoot', data: { mpRoot: p } }) } catch (_) {}
            return true
          } catch (err) {
            lastErr = err
            await new Promise(r => setTimeout(r, 200))
          }
        }
        try {
          await fsExtra.remove(p)
          try { notifyProgress({ type: 'finalize:removed_mpRoot', data: { mpRoot: p, method: 'fsExtra.remove' } }) } catch (_) {}
          return true
        } catch (err2) {
          try { await logger.logError('error:finalizeLibrary:rm-fallback', err2 as Error, {}) } catch (_) {}
          try { notifyProgress({ type: 'finalize:removed_failed', data: { mpRoot: p, error: String((err2 as any)?.message ?? String(err2)) } }) } catch (_) {}
          return false
        }
      }

      try {
        await tryRemove(mpRoot)
      } catch (_) {}
    }
  } catch (e) {
    try { await logger.logError('error:finalizeLibrary:rm-check', e as Error, {}) } catch (_) {}
  }
  return { ok: true, destino, summary }
}

export default finalizeLibrary
