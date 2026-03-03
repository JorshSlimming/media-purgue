import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fsp from 'fs/promises'
import { writeLote } from '../../apps/electron-main/src/jsonManager'
import { updateArchivoEstadoHandler } from '../../apps/electron-main/src/handlers/updateArchivoEstado'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'

let tmp = ''
beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-update-'))
})

afterEach(async () => {
  if (tmp) await fsp.rm(tmp, { recursive: true, force: true })
})

describe('updateArchivoEstado logging', () => {
  it('records file:stateChanged when archivo estado is updated', async () => {
    const mpRoot = path.join(tmp, '.media-purgue')
    const proc = path.join(mpRoot, '01_Procesando')
    await fsp.mkdir(proc, { recursive: true })
    const lotePath = path.join(proc, 'lote_0001.json')

    const lote = {
      lote_id: 1,
      tipo: 'imagenes',
      criterio: 'fecha_creacion',
      fecha_creacion: new Date().toISOString(),
      archivos: [
        { nombre: 'a.jpg', ruta_original: path.join(tmp, 'a.jpg'), tamano_bytes: 1, fecha_modificacion: new Date().toISOString(), estado: 'pendiente', orden: 1 }
      ]
    }

    await writeLote(lotePath, lote)

    const res: any = await updateArchivoEstadoHandler({ lotePath, orden: 1, nuevoEstado: 'conservar' })
    expect(res.ok).toBe(true)

    const logger = new ActivityLogger(path.resolve(mpRoot, '..'))
    const events = await logger.readEvents()
    expect(events.some(e => e.type === 'file:stateChanged')).toBe(true)
  })
})
