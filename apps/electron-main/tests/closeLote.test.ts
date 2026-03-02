import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { closeLote } from '../src/closeLote'

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-close-'))
})

afterEach(async () => {
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('closeLote flow', () => {
  it('moves conservar files and deletes eliminar files', async () => {
    // Prepare .media-purgue structure
    const mpRoot = path.join(tmpRoot, 'project')
    const proc = path.join(mpRoot, '.media-purgue', '01_Procesando')
    const biblioteca = path.join(mpRoot, '.media-purgue', '02_Biblioteca_Final')
    await fsp.mkdir(proc, { recursive: true })
    await fsp.mkdir(biblioteca, { recursive: true })

    // create two files: one conservar, one eliminar
    const origConservar = path.join(tmpRoot, 'keep.jpg')
    const origEliminar = path.join(tmpRoot, 'del.jpg')
    await fsp.writeFile(origConservar, 'keep', 'utf8')
    await fsp.writeFile(origEliminar, 'del', 'utf8')

    const loteDir = path.join(proc, 'imagenes_Lote_0001')
    await fsp.mkdir(loteDir, { recursive: true })
    const lotePath = path.join(loteDir, 'lote_0001.json')
    const lote = {
      lote_id: 1,
      tipo: 'imagenes',
      criterio: 'fecha_creacion',
      fecha_creacion: new Date().toISOString(),
      archivos: [
        { nombre: path.basename(origConservar), ruta_original: origConservar, tamano_bytes: 4, fecha_modificacion: new Date().toISOString(), estado: 'conservar', orden: 1 },
        { nombre: path.basename(origEliminar), ruta_original: origEliminar, tamano_bytes: 3, fecha_modificacion: new Date().toISOString(), estado: 'eliminar', orden: 2 }
      ]
    }
    await fsp.writeFile(lotePath, JSON.stringify(lote, null, 2), 'utf8')

    // run closeLote
    const res: any = await closeLote(lotePath)
    expect(res.ok).toBe(true)

    // check Biblioteca contains kept file
    const destDir = path.join(biblioteca, 'Imagenes')
    const files = await fsp.readdir(destDir)
    expect(files.some(f => f.includes(path.basename(origConservar)))).toBe(true)

    // original eliminar should be gone
    expect(fs.existsSync(origEliminar)).toBe(false)
  })
})
