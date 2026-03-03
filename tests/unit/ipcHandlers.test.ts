import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appendAppLogHandler, readAppLogHandler } from '../../apps/electron-main/src/ipcHandlers'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('IPC Handlers - unit tests', () => {
  let tmpRoot: string

  beforeEach(async () => {
    tmpRoot = path.join(os.tmpdir(), `ipc-handlers-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(tmpRoot, { recursive: true })
  })

  afterEach(async () => {
    try { await fs.rm(tmpRoot, { recursive: true, force: true }) } catch {}
  })

  it('appendAppLogHandler writes events and readAppLogHandler returns them', async () => {
    const res1 = await appendAppLogHandler(tmpRoot, { type: 'button:click', data: { who: 'alice' } })
    expect(res1.ok).toBe(true)

    const readRes = await readAppLogHandler(tmpRoot)
    expect(readRes.ok).toBe(true)
    expect(Array.isArray(readRes.entries)).toBe(true)
    expect(readRes.entries.length).toBeGreaterThanOrEqual(1)
    expect(readRes.entries[0].type).toBe('button:click')
  })

  it('readAppLogHandler supports type filters and searchText', async () => {
    await appendAppLogHandler(tmpRoot, { type: 'a:one', data: { v: 1 } })
    await appendAppLogHandler(tmpRoot, { type: 'b:two', data: { v: 2 } })
    await appendAppLogHandler(tmpRoot, { type: 'a:one', data: { v: 3, note: 'special' } })

    const filtered = await readAppLogHandler(tmpRoot, { types: ['a:one'] })
    expect(filtered.ok).toBe(true)
    expect(filtered.entries.every((e: any) => e.type === 'a:one')).toBe(true)

    const searched = await readAppLogHandler(tmpRoot, { searchText: 'special' })
    expect(searched.ok).toBe(true)
    expect(searched.entries.length).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(searched.entries).toLowerCase()).toContain('special')
  })
})
