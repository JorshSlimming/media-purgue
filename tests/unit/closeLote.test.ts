import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import fsExtra from 'fs-extra'
import { closeLote } from '../../apps/electron-main/src/closeLote'

let tmpRoot = ''
beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-close-'))
})

afterEach(async () => {
    vi.restoreAllMocks()
    if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

/** helper: create a lote JSON and its surrounding directory structure */
async function setupLote(
    tmpRoot: string,
    archivos: Array<{ nombre: string; ruta_original: string; tamano_bytes: number; estado: string }>
) {
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
    const lote = {
        lote_id: 1,
        tipo: 'imagenes',
        criterio: 'fecha_creacion',
        fecha_creacion: new Date().toISOString(),
        archivos: archivos.map((a, i) => ({
            ...a,
            fecha_modificacion: new Date().toISOString(),
            orden: i + 1,
        })),
    }
    await fsp.writeFile(lotePath, JSON.stringify(lote, null, 2), 'utf8')
    return { mpRoot, mpMeta, proc, biblioteca, logs, loteDir, lotePath }
}

describe('closeLote', () => {
    it('moves conservar files and deletes eliminar files', async () => {
        const origConservar = path.join(tmpRoot, 'keep.jpg')
        const origEliminar = path.join(tmpRoot, 'del.jpg')
        await fsp.writeFile(origConservar, 'keep', 'utf8')
        await fsp.writeFile(origEliminar, 'del', 'utf8')

        const { lotePath, biblioteca } = await setupLote(tmpRoot, [
            { nombre: 'keep.jpg', ruta_original: origConservar, tamano_bytes: 4, estado: 'conservar' },
            { nombre: 'del.jpg', ruta_original: origEliminar, tamano_bytes: 3, estado: 'eliminar' },
        ])

        const res: any = await closeLote(lotePath)
        expect(res.ok).toBe(true)

        // Biblioteca should contain the kept file
        const destDir = path.join(biblioteca, 'Imagenes')
        const files = await fsp.readdir(destDir)
        expect(files.some(f => f.includes('keep'))).toBe(true)

        // Original eliminar file should be gone
        expect(fs.existsSync(origEliminar)).toBe(false)
    })

    it('creates unique filename when destination already has same name', async () => {
        const origConservar = path.join(tmpRoot, 'keep.jpg')
        await fsp.writeFile(origConservar, 'keep', 'utf8')

        const { lotePath, biblioteca } = await setupLote(tmpRoot, [
            { nombre: 'keep.jpg', ruta_original: origConservar, tamano_bytes: 4, estado: 'conservar' },
        ])

        // Pre-create a file with the same name in destination
        const existing = path.join(biblioteca, 'Imagenes', 'keep.jpg')
        await fsp.writeFile(existing, 'orig', 'utf8')

        const res: any = await closeLote(lotePath)
        expect(res.ok).toBe(true)

        const files = await fsp.readdir(path.join(biblioteca, 'Imagenes'))
        // Both the original and the uniquely-renamed file should be present
        expect(files.length).toBeGreaterThanOrEqual(2)
        expect(files.some(f => f.startsWith('keep'))).toBe(true)
    })

    it('retries move operation when it fails initially then succeeds', async () => {
        const origConservar = path.join(tmpRoot, 'keep2.jpg')
        await fsp.writeFile(origConservar, 'keep', 'utf8')

        const { lotePath } = await setupLote(tmpRoot, [
            { nombre: 'keep2.jpg', ruta_original: origConservar, tamano_bytes: 4, estado: 'conservar' },
        ])

        // Mock fsExtra.move to fail once, then succeed
        const moveSpy = vi.spyOn(fsExtra, 'move')
        moveSpy.mockImplementationOnce(() => Promise.reject(new Error('temp fail')))
        moveSpy.mockImplementationOnce(() => Promise.resolve())

        const res: any = await closeLote(lotePath)
        expect(res.ok).toBe(true)
        expect(moveSpy).toHaveBeenCalled()
    })

    it('cleans staging and writes log when copy to staging fails', async () => {
        const origConservar = path.join(tmpRoot, 'keep3.jpg')
        await fsp.writeFile(origConservar, 'keep', 'utf8')

        const { lotePath, logs } = await setupLote(tmpRoot, [
            { nombre: 'keep3.jpg', ruta_original: origConservar, tamano_bytes: 4, estado: 'conservar' },
        ])

        // Mock fsExtra.copy to always fail
        const copySpy = vi.spyOn(fsExtra, 'copy')
        copySpy.mockImplementation(() => Promise.reject(new Error('copy fail')))

        await expect(closeLote(lotePath)).rejects.toThrow()

        // A log file should have been written
        const files = await fsp.readdir(logs)
        expect(files.some(f => f.endsWith('.json'))).toBe(true)
    })
})
