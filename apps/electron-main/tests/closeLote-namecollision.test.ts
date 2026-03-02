import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { closeLote } from '../src/closeLote'

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-collision-'))
})

afterEach(async () => {
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('closeLote name collision', () => {
  it('creates unique filename when destination already has a file with same name', async () => {
    const mpRoot = path.join(tmpRoot, 'project')
    const mpMeta = path.join(mpRoot, '.media-purgue')
    const proc = path.join(mpMeta, '01_Procesando')
    const biblioteca = path.join(mpMeta, '02_Biblioteca_Final')
    await fsp.mkdir(proc, { recursive: true })
    await fsp.mkdir(path.join(biblioteca, 'Imagenes'), { recursive: true })

    // create an existing file in destination with same name
    const existing = path.join(biblioteca, 'Imagenes', 'keep.jpg')
    await fsp.writeFile(existing, 'orig', 'utf8')

    // create original file to be conserved
    const origConservar = path.join(tmpRoot, 'keep.jpg')
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
        { nombre: 'keep.jpg', ruta_original: origConservar, tamano_bytes: 4, fecha_modificacion: new Date().toISOString(), estado: 'conservar', orden: 1 }
      ]
    }
    await fsp.writeFile(lotePath, JSON.stringify(lote, null, 2), 'utf8')

    const res: any = await closeLote(lotePath)
    expect(res.ok).toBe(true)
    const files = await fsp.readdir(path.join(biblioteca, 'Imagenes'))
    // should contain original plus a new uniquely named file
    expect(files.length).toBeGreaterThanOrEqual(2)
    expect(files.some(f => f.startsWith('keep'))).toBe(true)
  })
})
