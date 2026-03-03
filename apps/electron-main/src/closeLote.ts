import path from 'path'
import fs from 'fs'
import os from 'os'
import { readLote } from './jsonManager'
import { getActivityLogger } from './loggerRegistry'
import { ensureDir, copyFile, moveFile, unlinkFile } from './fsManager'
import { ensureStaging } from './stagingManager'
import { writeLogJSON } from './logger'
import fsExtra from 'fs-extra'
import { finalizeLibrary } from './finalizeLibrary'
import { notifyProgress } from './progressNotifier'

export async function closeLote(lotePath: string) {
  if (!lotePath) throw new Error('lotePath required')
  const lote = await readLote(lotePath)
  if (!lote) throw new Error('lote not found')

  const loteDir = path.dirname(lotePath)
  const mpRoot = path.resolve(loteDir, '..', '..')
  // mpRoot here points to the .media-purgue folder; ActivityLogger expects the
  // project root so its internal path becomes <project>/.media-purgue/Logs.
  const projectRoot = path.resolve(mpRoot, '..')
  const logger = getActivityLogger(projectRoot)
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
  let autoFinalized: any = null

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
      // attempt to remove original file after successful move from staging
      try {
        await withRetries(async () => { await fs.promises.unlink(f.ruta_original) }, 3)
        logEntries.push(`${new Date().toISOString()} INFO Eliminado original post-move: ${f.ruta_original}`)
      } catch (err: any) {
        logEntries.push(`${new Date().toISOString()} WARN No se pudo eliminar original post-move: ${f.ruta_original} -> ${err?.message || String(err)}`)
        try { await logger.logError('warn:closeLote:unlink_post_move', err, { file: f.ruta_original, lote_id: lote.lote_id }) } catch (_) {}
      }
    } catch (err: any) {
      logEntries.push(`${new Date().toISOString()} ERROR Mover fallo: ${src} -> ${err.message}`)
      try { await logger.logError('error:closeLote', err, { step: 'move', src, lote_id: lote.lote_id }) } catch (_) {}
      await writeLogJSON(path.join(mpRoot, 'Logs'), `lote_${lote.lote_id}.json`, { lote_id: lote.lote_id, error: err.message, entries: logEntries, fecha: new Date().toISOString() }, logger)
      return { ok: false, error: 'move_failed' }
    }
  }

  for (const [idx, f] of eliminados.entries()) {
    try {
      // attempt unlink with retries to avoid transient FS locks
      await withRetries(async () => { await fs.promises.unlink(f.ruta_original) }, 3)
      // verify
      if (fs.existsSync(f.ruta_original)) {
        throw new Error('still_exists')
      }
      logEntries.push(`${new Date().toISOString()} INFO Eliminado original: ${f.ruta_original}`)
    } catch (err: any) {
      const msg = err?.message || String(err)
      logEntries.push(`${new Date().toISOString()} ERROR Eliminar fallo: ${f.ruta_original} -> ${msg}`)
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
    archivos_procesados: (conservados.length || 0) + (eliminados.length || 0),
    espacio_conservado_bytes: conservados.reduce((s:any,f:any)=>s + (f.tamano_bytes||0), 0),
    espacio_eliminado_bytes: eliminados.reduce((s:any,f:any)=>s + (f.tamano_bytes||0), 0),
    entradas: logEntries
  }, logger)
  // Log successful close
  try {
    await logger.logEvent('lote:closed', { lote_id: lote.lote_id, conservados: conservados.length, eliminados: eliminados.length })
  } catch (_) {}

  // After successful close, check if there are remaining lotes to process. If none, auto-finalize.
  try {
    // Skip auto-finalize when running under test runner to avoid removing test fixtures
    if (process.env.VITEST) {
      return { ok: true, conservados: conservados.length, eliminados: eliminados.length }
    }
    const processingDir = path.join(mpRoot, '01_Procesando')
    let entries: string[] = []
    try { entries = await fs.promises.readdir(processingDir) } catch (_) { entries = [] }
    // determine if any directory contains lote files
    let hasRemaining = false
    for (const name of entries) {
      try {
        const p = path.join(processingDir, name)
        const stat = await fs.promises.stat(p).catch(() => null)
        if (stat && stat.isDirectory()) {
          const inner = await fs.promises.readdir(p).catch(() => [])
          if (inner && inner.length > 0) { hasRemaining = true; break }
        }
      } catch (_) {}
    }
    let autoFinalized: any = null
    if (!hasRemaining) {
      try { await logger.logEvent('finalize:autoStarted', { mpRoot }) } catch (_) {}
      try {
        // notify renderer that finalization is starting
        try { notifyProgress({ type: 'finalize:autoStarted', data: { mpRoot } }) } catch (_) {}
        const res = await finalizeLibrary(mpRoot)
        autoFinalized = res
        try { await logger.logEvent('finalize:autoFinished', { result: res }) } catch (_) {}
        // notify renderer that finalization finished
        try { notifyProgress({ type: 'finalize:autoFinished', data: res }) } catch (_) {}
      } catch (err: any) {
        try { await logger.logError('error:finalize:auto', err, {}) } catch (_) {}
        try { notifyProgress({ type: 'finalize:autoFailed', data: { error: String(err?.message || err) } }) } catch (_) {}
      }
    }
  } catch (_) {}

  const baseRes: any = { ok: true, conservados: conservados.length, eliminados: eliminados.length }
  if (autoFinalized) baseRes.autoFinalized = autoFinalized
  return baseRes
}

export default closeLote
