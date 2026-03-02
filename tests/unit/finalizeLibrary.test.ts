import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import fsExtra from 'fs-extra'
import { finalizeLibrary } from '../../apps/electron-main/src/finalizeLibrary'

let tmpRoot = ''
beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-finalize-'))
})

afterEach(async () => {
    vi.restoreAllMocks()
    if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

/** helper: create the .media-purgue structure needed by finalizeLibrary */
async function setupMpRoot(tmpRoot: string) {
    const mpRoot = path.join(tmpRoot, 'project')
    const mpMeta = path.join(mpRoot, '.media-purgue')
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

    // write config
    const cfg = { nombre_biblioteca: 'MiBiblioteca', ubicacion_biblioteca: '../' }
    await fsp.writeFile(path.join(config, 'usuario.json'), JSON.stringify(cfg), 'utf8')

    return { mpRoot, mpMeta, biblioteca, logs, config }
}

describe('finalizeLibrary', () => {
    it('moves Biblioteca_Final to configured location and writes global.json', async () => {
        const { mpMeta, logs } = await setupMpRoot(tmpRoot)

        // create a log so summary has data
        const log = { lote_id: 1, conservados: 1, eliminados: 0 }
        await fsp.writeFile(path.join(logs, 'lote_1.json'), JSON.stringify(log), 'utf8')

        const res: any = await finalizeLibrary(mpMeta)
        expect(res.ok).toBe(true)

        // destination should exist
        expect(fs.existsSync(res.destino)).toBe(true)

        // global.json should have been written
        const global = path.join(res.destino, 'global.json')
        expect(fs.existsSync(global)).toBe(true)
        const g = JSON.parse(await fsp.readFile(global, 'utf8'))
        expect(g.procesos).toBeGreaterThanOrEqual(1)

        // original mpMeta should be removed
        expect(fs.existsSync(mpMeta)).toBe(false)
    })

    it('falls back to copy when rename fails with EXDEV', async () => {
        const { mpMeta } = await setupMpRoot(tmpRoot)

        // spy on rename to throw EXDEV (cross-device link)
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
