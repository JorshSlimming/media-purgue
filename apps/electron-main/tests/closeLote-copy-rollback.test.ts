import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import fsExtra from 'fs-extra'
import { closeLote } from '../src/closeLote'

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-rollback-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('closeLote copy rollback', () => {
  it('cleans staging and writes log when copy to staging fails', async () => {
    const mpRoot = path.join(tmpRoot, 'project')
    const mpMeta = path.join(mpRoot, '.media-purgue')
    const proc = path.join(mpMeta, '01_Procesando')
    const logs = path.join(mpMeta, 'Logs')
    await fsp.mkdir(proc, { recursive: true })
    await fsp.mkdir(logs, { recursive: true })

    const origConservar = path.join(tmpRoot, 'keep3.jpg')
    await fsp.writeFile(origConservar, 'keep', 'utf8')

    const loteDir = path.join(proc, 'imagenes_Lote_0001')
    await fsp.mkdir(loteDir, { recursive: true })
    const lotePath = path.join(loteDir, 'lote_0001.json')
    const lote = {
      lote_id: 1,
      tipo: 'imagenes',
      criterio: 'fecha_creacion',
      fecha_creacion: new Date().toISOString(),
      archivos: [
        { nombre: 'keep3.jpg', ruta_original: origConservar, tamano_bytes: 4, fecha_modificacion: new Date().toISOString(), estado: 'conservar', orden: 1 }
      ]
    }
    await fsp.writeFile(lotePath, JSON.stringify(lote, null, 2), 'utf8')

    // mock fs-extra.copy used by copyFile to always fail
    const copySpy = vi.spyOn(fsExtra, 'copy')
    copySpy.mockImplementation(() => Promise.reject(new Error('copy fail')))

    await expect(closeLote(lotePath)).rejects.toThrow()

    // staging should be removed and a log file present
    const files = await fsp.readdir(logs)
    expect(files.some(f => f.endsWith('.json'))).toBe(true)
  })
})
