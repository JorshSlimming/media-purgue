import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('ActivityLogger - Event Metadata Properties', () => {
  let tmpRoot: string
  let logger: ActivityLogger

  beforeEach(async () => {
    // Create a temporary directory for testing
    tmpRoot = path.join(os.tmpdir(), `activity-logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(tmpRoot, { recursive: true })
    logger = new ActivityLogger(tmpRoot)
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  /**
   * Feature: comprehensive-activity-logging, Property 9: Events have valid UUID and ISO 8601 timestamp
   * 
   * **Validates: Requirements 8.4, 8.5**
   * 
   * For any event created by the ActivityLogger, the event should include:
   * - A valid UUID v4 identifier
   * - A valid ISO 8601 timestamp
   */
  it('Property 9: all events have valid UUID v4 and ISO 8601 timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.option(fc.record({
          someField: fc.string(),
          someNumber: fc.integer(),
          someBoolean: fc.boolean()
        }), { nil: undefined }),
        async (eventType, eventData) => {
          // Log an event with arbitrary type and data
          await logger.logEvent(eventType, eventData)
          
          // Read back the events
          const events = await logger.readEvents()
          const latest = events[events.length - 1]
          
          // Verify UUID v4 format
          // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
          // where y is one of [8, 9, a, b]
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          expect(latest.id).toMatch(uuidRegex)
          
          // Verify ISO 8601 timestamp
          // Parse the timestamp and verify it's valid by converting back to ISO string
          const isoDate = new Date(latest.timestamp)
          expect(isoDate.toISOString()).toBe(latest.timestamp)
          
          // Additional validation: timestamp should be a recent time (within last minute)
          const now = Date.now()
          const eventTime = isoDate.getTime()
          const timeDiff = now - eventTime
          expect(timeDiff).toBeGreaterThanOrEqual(0)
          expect(timeDiff).toBeLessThan(60000) // Less than 1 minute
        }
      ),
      { numRuns: 100 }
    )
  })
})
