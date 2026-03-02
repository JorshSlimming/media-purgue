import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import fsExtra from 'fs-extra'
import { finalizeLibrary } from '../src/finalizeLibrary'

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-finalize-exdev-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('finalizeLibrary EXDEV fallback', () => {
  it('falls back to copy when rename fails', async () => {
    const mpRoot = path.join(tmpRoot, 'project')
    const mpMeta = path.join(mpRoot, '.media-purgue')
    const biblioteca = path.join(mpMeta, '02_Biblioteca_Final')
    const logs = path.join(mpMeta, 'Logs')
    const config = path.join(mpMeta, 'Config')
    await fsp.mkdir(biblioteca, { recursive: true })
    await fsp.mkdir(logs, { recursive: true })
    await fsp.mkdir(config, { recursive: true })

    // create file inside Biblioteca_Final
    const kept = path.join(biblioteca, 'Imagenes')
    await fsp.mkdir(kept, { recursive: true })
    await fsp.writeFile(path.join(kept, 'x.jpg'), 'x', 'utf8')

    // write config to move biblioteca to parent of mpRoot
    const cfg = { nombre_biblioteca: 'MiBiblioteca', ubicacion_biblioteca: '../' }
    await fsp.writeFile(path.join(config, 'usuario.json'), JSON.stringify(cfg), 'utf8')

    // spy rename to throw (simulate EXDEV)
    const originalRename = fs.promises.rename
    vi.spyOn(fs.promises, 'rename').mockImplementationOnce(() => {
      const e: any = new Error('EXDEV simulated')
      e.code = 'EXDEV'
      return Promise.reject(e)
    })

    const spyCopy = vi.spyOn(fsExtra, 'copy')

    const res: any = await finalizeLibrary(mpMeta)
    expect(res.ok).toBe(true)
    expect(spyCopy).toHaveBeenCalled()
    expect(fs.existsSync(res.destino)).toBe(true)
  })
})
