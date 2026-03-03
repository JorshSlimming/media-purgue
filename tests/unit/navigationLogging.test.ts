import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fsp from 'fs/promises'
import { appendAppLogHandler, readAppLogHandler } from '../../apps/electron-main/src/ipcHandlers'

let tmp = ''
beforeEach(async () => {
  tmp = path.join(os.tmpdir(), `mp-nav-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fsp.mkdir(tmp, { recursive: true })
})

afterEach(async () => {
  try { await fsp.rm(tmp, { recursive: true, force: true }) } catch (_) {}
})

describe('navigation event logging', () => {
  it('persists navigation events and readAppLogHandler can filter them', async () => {
    await appendAppLogHandler(tmp, { type: 'navigation:openLote', data: { loteId: 1 } })
    await appendAppLogHandler(tmp, { type: 'navigation:back', data: { from: 'lote' } })
    await appendAppLogHandler(tmp, { type: 'navigation:openGlobalSummary', data: {} })

    const all = await readAppLogHandler(tmp)
    expect(all.ok).toBe(true)
    expect(all.entries.length).toBeGreaterThanOrEqual(3)

    const filtered = await readAppLogHandler(tmp, { types: ['navigation:openLote', 'navigation:back'] })
    expect(filtered.ok).toBe(true)
    expect(filtered.entries.every((e: any) => e.type.startsWith('navigation:'))).toBe(true)
  })
})
