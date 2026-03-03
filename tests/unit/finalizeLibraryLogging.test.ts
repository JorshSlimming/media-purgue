import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import fs from 'fs'
import fsExtra from 'fs-extra'
import { finalizeLibrary } from '../../apps/electron-main/src/finalizeLibrary'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-finalize-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('finalizeLibrary logging', () => {
  it('logs errors when rename and copy both fail', async () => {
    const mpRoot = path.join(tmpRoot, '.media-purgue')
    const final = path.join(mpRoot, '02_Biblioteca_Final')
    await fsp.mkdir(final, { recursive: true })

    // Mock rename to throw
    const renameSpy = vi.spyOn(fs.promises, 'rename' as any)
    renameSpy.mockImplementation(() => Promise.reject(new Error('rename fail')))

    // Mock copy to throw
    const copySpy = vi.spyOn(fsExtra, 'copy')
    copySpy.mockImplementation(() => Promise.reject(new Error('copy fail')))

    const res: any = await finalizeLibrary(mpRoot)
    expect(res.ok).toBe(true)

    const logger = new ActivityLogger(path.join(mpRoot, '..'))
    const events = await logger.readEvents()
    const types = events.map(e => e.type)
    // Expect at least one error event recorded for finalizeLibrary
    expect(types.some(t => t === 'error:finalizeLibrary')).toBe(true)
  })
})
