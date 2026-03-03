import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import os from 'os'
import fsp from 'fs/promises'
import fs from 'fs/promises'
import { writeLogJSON, readLogJSON } from '../../apps/electron-main/src/logger'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'

let tmp = ''
beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-log-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  if (tmp) await fsp.rm(tmp, { recursive: true, force: true })
})

describe('logger read/write error events', () => {
  it('logs error when writeLogJSON fails', async () => {
    const projectRoot = path.join(tmp, 'proj')
    const logger = new ActivityLogger(projectRoot)

    // make fs.mkdir throw only for the target dir so logger can still write events
    const origMkdir = fs.mkdir.bind(fs)
    const dir = path.join(projectRoot, 'Logs')
    const spy = vi.spyOn(fs, 'mkdir')
    spy.mockImplementation((p: string, opts?: any) => {
      if (p === dir) return Promise.reject(new Error('mkdir fail'))
      return origMkdir(p, opts)
    })

    await expect(writeLogJSON(dir, 'x.json', { a: 1 }, logger)).rejects.toThrow()

    const events = await logger.readEvents()
    expect(events.some(e => e.type === 'error:writeLogJSON')).toBe(true)
  })

  it('logs error when readLogJSON fails', async () => {
    const projectRoot = path.join(tmp, 'proj2')
    const logger = new ActivityLogger(projectRoot)

    const filePath = path.join(projectRoot, 'Logs', 'missing.json')
    // spy on fs.readFile but only for the target filePath so ActivityLogger reads still work
    const origRead = fs.readFile.bind(fs)
    const spy = vi.spyOn(fs, 'readFile')
    spy.mockImplementation((p: string, opts?: any) => {
      if (p === filePath) return Promise.reject(new Error('read fail'))
      return origRead(p, opts)
    })

    const res = await readLogJSON(filePath, logger)
    expect(res).toBeNull()

    const events = await logger.readEvents()
    expect(events.some(e => e.type === 'error:readLogJSON')).toBe(true)
  })
})
