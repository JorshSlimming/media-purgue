import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('ActivityLogger - Unit tests', () => {
  let tmpRoot: string
  let logger: ActivityLogger

  beforeEach(async () => {
    tmpRoot = path.join(os.tmpdir(), `activity-logger-unit-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(tmpRoot, { recursive: true })
    logger = new ActivityLogger(tmpRoot)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    } catch {}
  })

  it('creates events file when it does not exist', async () => {
    // Ensure logs dir does not exist yet
    const logsDir = path.join(tmpRoot, '.media-purgue', 'Logs')
    // Log an event - this should create the directory and file
    await logger.logEvent('unit:testCreate', { foo: 'bar' })

    const files = await fs.readdir(logsDir)
    expect(files).toContain('app_events.json')

    const events = await logger.readEvents()
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].type).toBe('unit:testCreate')
  })

  it('recovers gracefully from corrupted JSON', async () => {
    const logsDir = path.join(tmpRoot, '.media-purgue', 'Logs')
    await fs.mkdir(logsDir, { recursive: true })

    // Write a corrupted JSON file
    const bad = '{ "entries": [ { "id": "1", "timestamp": "2020", "type": "a" }, '
    await fs.writeFile(path.join(logsDir, 'app_events.json'), bad, 'utf8')

    // readEvents should not throw and should return an array (attempt recovery)
    const events = await logger.readEvents()
    expect(Array.isArray(events)).toBe(true)
  })

  it('propagates ENOSPC (disk full) errors from write operations', async () => {
    // Spy on fs.writeFile to simulate disk full
    const writeSpy = vi.spyOn(fs, 'writeFile' as any).mockImplementation(() => Promise.reject(Object.assign(new Error('No space'), { code: 'ENOSPC' })))

    await expect(logger.logEvent('unit:diskFull', {})).rejects.toMatchObject({ code: 'ENOSPC' })
    writeSpy.mockRestore()
  })

  it('propagates permission errors from write operations', async () => {
    const writeSpy = vi.spyOn(fs, 'writeFile' as any).mockImplementation(() => Promise.reject(Object.assign(new Error('Permission denied'), { code: 'EACCES' })))

    await expect(logger.logEvent('unit:perm', {})).rejects.toMatchObject({ code: 'EACCES' })
    writeSpy.mockRestore()
  })
})
