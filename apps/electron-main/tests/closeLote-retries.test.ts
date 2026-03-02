import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import fsExtra from 'fs-extra'
import { closeLote } from '../src/closeLote'

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-retries-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('closeLote retries', () => {
  it('retries move operation when it fails initially then succeeds', async () => {
    const mpRoot = path.join(tmpRoot, 'project')
    const mpMeta = path.join(mpRoot, '.media-purgue')
    const proc = path.join(mpMeta, '01_Procesando')
    const biblioteca = path.join(mpMeta, '02_Biblioteca_Final')
    await fsp.mkdir(proc, { recursive: true })
    await fsp.mkdir(path.join(biblioteca, 'Imagenes'), { recursive: true })

    const origConservar = path.join(tmpRoot, 'keep2.jpg')
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
        { nombre: 'keep2.jpg', ruta_original: origConservar, tamano_bytes: 4, fecha_modificacion: new Date().toISOString(), estado: 'conservar', orden: 1 }
      ]
    }
    await fsp.writeFile(lotePath, JSON.stringify(lote, null, 2), 'utf8')

    // Spy on fs-extra.move to fail first time, succeed second time
    const moveSpy = vi.spyOn(fsExtra, 'move')
    moveSpy.mockImplementationOnce(() => Promise.reject(new Error('temp fail')))
    moveSpy.mockImplementationOnce((src, dest) => Promise.resolve())

    const res: any = await closeLote(lotePath)
    expect(res.ok).toBe(true)
    expect(moveSpy).toHaveBeenCalled()
  })
})
