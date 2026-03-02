import fs from 'fs'
import path from 'path'
import fsExtra from 'fs-extra'
import { readJson } from './fsManager'
import { readLogJSON } from './logger'

export async function finalizeLibrary(mpRoot: string) {
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
    summary.conservados += content.conservados || 0
    summary.eliminados += content.eliminados || 0
  }

  const configPath = path.join(mpRoot, 'Config', 'usuario.json')
  const usuario = await readJson(configPath)
  const destino = usuario?.ubicacion_biblioteca ? path.resolve(mpRoot, usuario.ubicacion_biblioteca, usuario?.nombre_biblioteca || 'Biblioteca_Final') : path.resolve(mpRoot, '..', usuario?.nombre_biblioteca || 'Biblioteca_Final')
  try {
    const src = path.join(mpRoot, '02_Biblioteca_Final')
    await fs.promises.mkdir(path.dirname(destino), { recursive: true })
    await fs.promises.rename(src, destino)
  } catch (err) {
    try {
      await fsExtra.copy(path.join(mpRoot, '02_Biblioteca_Final'), destino, { overwrite: false })
    } catch (_) {}
  }
  try {
    await fs.promises.writeFile(path.join(path.resolve(destino), 'global.json'), JSON.stringify(summary, null, 2), 'utf8')
  } catch (_) {}
  try { await fs.promises.rm(mpRoot, { recursive: true, force: true }) } catch (_) {}
  return { ok: true, destino, summary }
}

export default finalizeLibrary
