import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { ensureDir, writeJsonAtomic, readJson, copyFile, moveFile, unlinkFile, scanMediaFiles } from '../../apps/electron-main/src/fsManager'

let tmpRoot = ''
beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-test-'))
})

afterEach(async () => {
    if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('fsManager basics', () => {
    it('writeJsonAtomic and readJson', async () => {
        const p = path.join(tmpRoot, 'config', 'test.json')
        await writeJsonAtomic(p, { a: 1, b: 'x' })
        const r = await readJson(p)
        expect(r).toEqual({ a: 1, b: 'x' })
    })

    it('copy/move/unlink', async () => {
        const src = path.join(tmpRoot, 'src.txt')
        const mid = path.join(tmpRoot, 'mid', 'copied.txt')
        const dest = path.join(tmpRoot, 'final', 'moved.txt')
        await ensureDir(path.dirname(src))
        await fsp.writeFile(src, 'hello', 'utf8')
        await copyFile(src, mid)
        expect(fs.existsSync(mid)).toBe(true)
        await moveFile(mid, dest)
        expect(fs.existsSync(dest)).toBe(true)
        await unlinkFile(dest)
        expect(fs.existsSync(dest)).toBe(false)
    })

    it('scanMediaFiles finds images and videos', async () => {
        const img = path.join(tmpRoot, 'a.jpg')
        const vid = path.join(tmpRoot, 'sub', 'b.mp4')
        await ensureDir(path.dirname(vid))
        await fsp.writeFile(img, 'x', 'utf8')
        await fsp.writeFile(vid, 'y', 'utf8')
        const res = await scanMediaFiles(tmpRoot, true)
        expect(res.images.length).toBeGreaterThanOrEqual(1)
        expect(res.videos.length).toBeGreaterThanOrEqual(1)
    })
})
