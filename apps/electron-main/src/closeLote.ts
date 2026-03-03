import path from 'path'
import fs from 'fs'
import os from 'os'
import { readLote } from './jsonManager'
import { ActivityLogger } from './activityLogger'
import { ensureDir, copyFile, moveFile, unlinkFile } from './fsManager'
import { ensureStaging } from './stagingManager'
import { writeLogJSON } from './logger'
import fsExtra from 'fs-extra'

export async function closeLote(lotePath: string) {
  if (!lotePath) throw new Error('lotePath required')
  const lote = await readLote(lotePath)
  if (!lote) throw new Error('lote not found')

  const loteDir = path.dirname(lotePath)
  const mpRoot = path.resolve(loteDir, '..', '..')
  // mpRoot here points to the .media-purgue folder; ActivityLogger expects the
  // project root so its internal path becomes <project>/.media-purgue/Logs.
  const projectRoot = path.resolve(mpRoot, '..')
  const logger = new ActivityLogger(projectRoot)
  const staging = await ensureStaging(mpRoot)
  const biblioteca = path.join(mpRoot, '02_Biblioteca_Final')
  const tipoFolder = lote.tipo === 'imagenes' ? 'Imagenes' : 'Videos'
  const destinoFolder = path.join(biblioteca, tipoFolder)
  await ensureDir(destinoFolder)

  const conservados = lote.archivos.filter(a => a.estado === 'conservar')
  const eliminados = lote.archivos.filter(a => a.estado === 'eliminar')

  // Log start of lote close
  try {
    await logger.logEvent('lote:closing', { lote_id: lote.lote_id, conservados: conservados.length, eliminados: eliminados.length })
  } catch (_) {}

  const logEntries: string[] = []

  async function uniqueDest(destDir: string, name: string) {
    const ext = path.extname(name)
    const nameOnly = path.basename(name, ext)
    let candidate = name
    let i = 1
    while (fs.existsSync(path.join(destDir, candidate))) {
      candidate = `${nameOnly}_${i}${ext}`
      i++
    }
    return path.join(destDir, candidate)
  }

  async function withRetries(fn: () => Promise<void>, attempts = 3) {
    let lastErr: any
    for (let i = 0; i < attempts; i++) {
      try {
        await fn()
        return
      } catch (err) {
        lastErr = err
        await new Promise(r => setTimeout(r, 200))
      }
    }
    throw lastErr
  }

  const copiedToStaging: string[] = []
  for (const [idx, f] of conservados.entries()) {
    const dest = path.join(staging, f.nombre)
    try {
      await withRetries(async () => { await copyFile(f.ruta_original, dest, logger) })
      copiedToStaging.push(dest)
      logEntries.push(`${new Date().toISOString()} INFO Copiado a staging: ${f.ruta_original} -> ${dest}`)
    } catch (err: any) {
      logEntries.push(`${new Date().toISOString()} ERROR Copiar fallo: ${f.ruta_original} -> ${err.message}`)
      try { await fs.promises.rm(staging, { recursive: true, force: true }) } catch (_) {}
      try { await logger.logError('error:closeLote', err, { step: 'copy', file: f.ruta_original, lote_id: lote.lote_id }) } catch (_) {}
      await writeLogJSON(path.join(mpRoot, 'Logs'), `lote_${lote.lote_id}.json`, { lote_id: lote.lote_id, error: err?.message || 'copy_failed', entries: logEntries, fecha: new Date().toISOString() }, logger)
      throw err
    }
  }

  for (const [idx, f] of conservados.entries()) {
    const src = path.join(staging, f.nombre)
    try {
      const destFinal = await uniqueDest(destinoFolder, f.nombre)
      await withRetries(async () => { await moveFile(src, destFinal, logger) })
      logEntries.push(`${new Date().toISOString()} INFO Movido a Biblioteca: ${destFinal}`)
    } catch (err: any) {
      logEntries.push(`${new Date().toISOString()} ERROR Mover fallo: ${src} -> ${err.message}`)
      try { await logger.logError('error:closeLote', err, { step: 'move', src, lote_id: lote.lote_id }) } catch (_) {}
      await writeLogJSON(path.join(mpRoot, 'Logs'), `lote_${lote.lote_id}.json`, { lote_id: lote.lote_id, error: err.message, entries: logEntries, fecha: new Date().toISOString() }, logger)
      return { ok: false, error: 'move_failed' }
    }
  }

  for (const [idx, f] of eliminados.entries()) {
    try {
      await unlinkFile(f.ruta_original, logger)
      logEntries.push(`${new Date().toISOString()} INFO Eliminado original: ${f.ruta_original}`)
    } catch (err: any) {
      logEntries.push(`${new Date().toISOString()} ERROR Eliminar fallo: ${f.ruta_original} -> ${err.message}`)
      try { await logger.logError('error:closeLote', err, { step: 'unlink', file: f.ruta_original, lote_id: lote.lote_id }) } catch (_) {}
    }
  }

  try {
    await fs.promises.rm(loteDir, { recursive: true, force: true })
    logEntries.push(`${new Date().toISOString()} INFO Eliminada carpeta de lote: ${loteDir}`)
  } catch (err: any) {
    logEntries.push(`${new Date().toISOString()} ERROR No se pudo eliminar carpeta lote: ${err.message}`)
    try { await logger.logError('error:closeLote', err, { step: 'rmdir_lote', lote_dir: loteDir, lote_id: lote.lote_id }) } catch (_) {}
  }

  try {
    const remaining = await fs.promises.readdir(staging)
    if (remaining.length === 0) await fs.promises.rmdir(staging)
  } catch (_) {}

  await writeLogJSON(path.join(mpRoot, 'Logs'), `lote_${lote.lote_id}.json`, {
    lote_id: lote.lote_id,
    tipo: lote.tipo,
    fecha_cierre: new Date().toISOString(),
    conservados: conservados.length,
    eliminados: eliminados.length,
    entradas: logEntries
  }, logger)
  // Log successful close
  try {
    await logger.logEvent('lote:closed', { lote_id: lote.lote_id, conservados: conservados.length, eliminados: eliminados.length })
  } catch (_) {}
  return { ok: true, conservados: conservados.length, eliminados: eliminados.length }
}

export default closeLote
