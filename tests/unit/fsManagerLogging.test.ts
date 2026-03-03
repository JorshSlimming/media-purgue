import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import fs from 'fs'
import fsExtra from 'fs-extra'
import { copyFile, moveFile, unlinkFile } from '../../apps/electron-main/src/fsManager'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'

let tmpRoot = ''
beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-fslog-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  if (tmpRoot) await fsp.rm(tmpRoot, { recursive: true, force: true })
})

describe('fsManager logging on errors', () => {
  it('logs error when copyFile fails', async () => {
    const projectRoot = path.join(tmpRoot, 'proj')
    const logger = new ActivityLogger(projectRoot)

    // force fs-extra copy to fail
    const spy = vi.spyOn(fsExtra, 'copy')
    spy.mockImplementation(() => Promise.reject(new Error('copy fail')))

    const src = path.join(tmpRoot, 'nope.jpg')
    const dest = path.join(projectRoot, 'out', 'nope.jpg')

    await expect(copyFile(src, dest, logger)).rejects.toThrow()

    const events = await logger.readEvents()
    const types = events.map(e => e.type)
    expect(types.some(t => t === 'error:copyFile')).toBe(true)
  })

  it('logs error when moveFile fails', async () => {
    const projectRoot = path.join(tmpRoot, 'proj2')
    const logger = new ActivityLogger(projectRoot)

    const spy = vi.spyOn(fsExtra, 'move')
    spy.mockImplementation(() => Promise.reject(new Error('move fail')))

    const src = path.join(tmpRoot, 'src.txt')
    const dest = path.join(projectRoot, 'final', 'dst.txt')
    await fsp.writeFile(src, 'x', 'utf8')

    await expect(moveFile(src, dest, logger)).rejects.toThrow()

    const events = await logger.readEvents()
    const types = events.map(e => e.type)
    expect(types.some(t => t === 'error:moveFile')).toBe(true)
  })

  it('logs error when unlinkFile fails', async () => {
    const projectRoot = path.join(tmpRoot, 'proj3')
    const logger = new ActivityLogger(projectRoot)

    // spy on unlink to throw
    const unlink = vi.spyOn(fsp, 'unlink' as any)
    unlink.mockImplementation(() => Promise.reject(new Error('unlink fail')))

    const target = path.join(tmpRoot, 'will-not-delete.txt')
    await fsp.writeFile(target, 'x', 'utf8')

    // unlinkFile swallows errors, so it should not throw
    await unlinkFile(target, logger)

    const events = await logger.readEvents()
    const types = events.map(e => e.type)
    expect(types.some(t => t === 'error:unlinkFile')).toBe(true)
  })
})
