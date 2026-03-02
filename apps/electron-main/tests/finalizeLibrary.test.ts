import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { finalizeLibrary } from '../src/finalizeLibrary'

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-finalize-'))
})

afterEach(async () => {
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('finalizeLibrary', () => {
  it('moves Biblioteca_Final to configured location and writes global.json', async () => {
    const mpRoot = path.join(tmpRoot, 'project')
    const mpMeta = path.join(mpRoot, '.media-purgue')
    const proc = path.join(mpMeta, '01_Procesando')
    const biblioteca = path.join(mpMeta, '02_Biblioteca_Final')
    const logs = path.join(mpMeta, 'Logs')
    const config = path.join(mpMeta, 'Config')
    await fsp.mkdir(biblioteca, { recursive: true })
    await fsp.mkdir(logs, { recursive: true })
    await fsp.mkdir(config, { recursive: true })

    // create a dummy file in Biblioteca_Final
    const kept = path.join(biblioteca, 'Imagenes')
    await fsp.mkdir(kept, { recursive: true })
    await fsp.writeFile(path.join(kept, 'x.jpg'), 'x', 'utf8')

    // create a log
    const log = { lote_id: 1, conservados: 1, eliminados: 0 }
    await fsp.writeFile(path.join(logs, 'lote_1.json'), JSON.stringify(log), 'utf8')

    // write config to move biblioteca to parent of mpRoot
    const cfg = { nombre_biblioteca: 'MiBiblioteca', ubicacion_biblioteca: '../' }
    await fsp.writeFile(path.join(config, 'usuario.json'), JSON.stringify(cfg), 'utf8')

    const res: any = await finalizeLibrary(mpMeta)
    expect(res.ok).toBe(true)
    // destination should exist
    expect(fs.existsSync(res.destino)).toBe(true)
    const global = path.join(res.destino, 'global.json')
    expect(fs.existsSync(global)).toBe(true)
    const g = JSON.parse(await fsp.readFile(global, 'utf8'))
    expect(g.procesos).toBeGreaterThanOrEqual(1)
    // original mpMeta removed
    expect(fs.existsSync(mpMeta)).toBe(false)
  })
})
