import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fsp from 'fs/promises'
import { safeIpcWrapper } from '../../apps/electron-main/src/ipcHandlers'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'

let tmp = ''
beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-ipc-'))
})

afterEach(async () => {
  if (tmp) await fsp.rm(tmp, { recursive: true, force: true })
})

describe('safeIpcWrapper', () => {
  it('logs error when wrapped function throws', async () => {
    const res = await safeIpcWrapper(tmp, 'testHandler', async () => { throw new Error('boom') })
    expect(res.ok).toBe(false)
    const logger = new ActivityLogger(tmp)
    const events = await logger.readEvents()
    expect(events.some(e => e.type === 'error:ipc:testHandler')).toBe(true)
  })
})
