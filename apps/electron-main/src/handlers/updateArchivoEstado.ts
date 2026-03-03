import path from 'path'
import { readLote, writeLote } from '../jsonManager'
import { ActivityLogger } from '../activityLogger'

export async function updateArchivoEstadoHandler(args: any) {
  const { lotePath, orden, nuevoEstado } = args || {}
  if (!lotePath) throw new Error('lotePath required')
  const lote = await readLote(lotePath)
  if (!lote) throw new Error('lote not found')
  const entry = lote.archivos.find((a: any) => a.orden === orden)
  if (!entry) throw new Error('archivo not found in lote')
  entry.estado = nuevoEstado

  try {
    const loteDir = path.dirname(lotePath)
    const projectRoot = path.resolve(loteDir, '..', '..')
    const upLogger = new ActivityLogger(projectRoot)
    await writeLote(lotePath, lote, upLogger)
    try { await upLogger.logEvent('file:stateChanged', { lotePath, orden, nuevoEstado, nombre: entry.nombre }) } catch (_) {}
  } catch (_) {
    await writeLote(lotePath, lote)
  }

  return { ok: true }
}
