import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { appendAppLogHandler, readAppLogHandler } from '../../apps/electron-main/src/ipcHandlers'

describe('ActivityLogger - Button Click Logging Property', () => {
  let tmpRoot: string

  beforeEach(async () => {
    tmpRoot = path.join(os.tmpdir(), `button-logging-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(tmpRoot, { recursive: true })
  })

  afterEach(async () => {
    try { await fs.rm(tmpRoot, { recursive: true, force: true }) } catch (_) {}
  })

  it('Property: button events appended by renderer persist with id and timestamp', async () => {
    const buttonTypes = [
      'button:openConfig',
      'button:back',
      'button:startProcess',
      'button:selectFolder',
      'button:toggleLogs',
      'button:confirmClose'
    ]

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...buttonTypes),
        fc.option(fc.record({
          text: fc.string(),
          n: fc.integer(),
          flag: fc.boolean()
        }), { nil: undefined }),
        async (type, data) => {
          // Append event via the IPC handler (simulating renderer)
          const appendRes = await appendAppLogHandler(tmpRoot, { type, data })
          expect(appendRes.ok).toBe(true)

          // Read back events
          const readRes: any = await readAppLogHandler(tmpRoot)
          expect(readRes.ok).toBe(true)
          const entries = readRes.entries || []

          // Find a matching event (handle undefined data case specially)
          const found = entries.find((e: any) => e.type === type && (data === undefined ? true : JSON.stringify(e.data) === JSON.stringify(data)))
          expect(found).toBeDefined()

          // If data was provided, ensure it matches; otherwise just ensure type exists
          if (data !== undefined) {
            expect(found.data).toEqual(data)
          }

          // Validate id looks like a UUID and timestamp is parseable
          expect(typeof found.id).toBe('string')
          expect(found.id.length).toBeGreaterThan(8)
          const t = Date.parse(found.timestamp)
          expect(Number.isFinite(t)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })
})
