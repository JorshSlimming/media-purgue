import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { closeLote } from '../../apps/electron-main/src/closeLote'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'

async function setupLote(tmpRoot: string) {
  const mpRoot = path.join(tmpRoot, 'project')
  const mpMeta = path.join(mpRoot, '.media-purgue')
  const proc = path.join(mpMeta, '01_Procesando')
  const biblioteca = path.join(mpMeta, '02_Biblioteca_Final')
  const logs = path.join(mpMeta, 'Logs')
  await fsp.mkdir(proc, { recursive: true })
  await fsp.mkdir(path.join(biblioteca, 'Imagenes'), { recursive: true })
  await fsp.mkdir(logs, { recursive: true })

  const loteDir = path.join(proc, 'imagenes_Lote_0001')
  await fsp.mkdir(loteDir, { recursive: true })
  const lotePath = path.join(loteDir, 'lote_0001.json')

  const origKeep = path.join(tmpRoot, 'keep.jpg')
  const origDel = path.join(tmpRoot, 'del.jpg')
  await fsp.writeFile(origKeep, 'x', 'utf8')
  await fsp.writeFile(origDel, 'y', 'utf8')

  const lote = {
    lote_id: 1,
    tipo: 'imagenes',
    criterio: 'fecha_creacion',
    fecha_creacion: new Date().toISOString(),
    archivos: [
      { nombre: 'keep.jpg', ruta_original: origKeep, tamano_bytes: 1, fecha_modificacion: new Date().toISOString(), estado: 'conservar', orden: 1 },
      { nombre: 'del.jpg', ruta_original: origDel, tamano_bytes: 1, fecha_modificacion: new Date().toISOString(), estado: 'eliminar', orden: 2 }
    ]
  }
  await fsp.writeFile(lotePath, JSON.stringify(lote, null, 2), 'utf8')
  return { mpRoot, lotePath }
}

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-close-'))
})

afterEach(async () => {
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('closeLote logging', () => {
  it('writes lote:closing and lote:closed events', async () => {
    const { mpRoot, lotePath } = await setupLote(tmpRoot)
    const res: any = await closeLote(lotePath)
    expect(res.ok).toBe(true)

    const logger = new ActivityLogger(mpRoot)
    // readEvents may take a moment to appear on disk; poll briefly
    let events: any[] = []
    for (let i = 0; i < 10; i++) {
      events = await logger.readEvents()
      if (events.length > 0) break
      await new Promise(r => setTimeout(r, 50))
    }
    const types = events.map(e => e.type)
    expect(types).toContain('lote:closing')
    expect(types).toContain('lote:closed')
  })
})
