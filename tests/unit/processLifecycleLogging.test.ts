import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'
import { readAppLogHandler } from '../../apps/electron-main/src/ipcHandlers'

describe('process lifecycle logging', () => {
  it('records scan lifecycle events', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-test-'))
    // ActivityLogger expects project root; it will create .media-purgue under this root
    const logger = new ActivityLogger(tmp)

    await logger.logEvent('scan:starting', { includeSubfolders: true }).catch(() => {})
    await logger.logEvent('scan:loteCreated', { loteId: 1, lotePath: '/fake/lote/1.json', tipo: 'imagenes' }).catch(() => {})
    await logger.logEvent('scan:done', { createdCount: 1 }).catch(() => {})

    const res = await readAppLogHandler(tmp, { types: ['scan:starting', 'scan:loteCreated', 'scan:done'] })
    expect(res.ok).toBeTruthy()
    const events = res.entries || []

    expect(events.some((e: any) => e.type === 'scan:starting')).toBeTruthy()
    expect(events.filter((e: any) => e.type === 'scan:loteCreated').length).toBeGreaterThanOrEqual(1)
    expect(events.some((e: any) => e.type === 'scan:done')).toBeTruthy()
  })
})
