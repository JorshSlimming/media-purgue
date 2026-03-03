import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('ActivityLogger - Event Persistence Properties', () => {
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
   * Feature: comprehensive-activity-logging, Property 8: Events persist and can be read back
   * 
   * **Validates: Requirements 8.1, 8.2**
   * 
   * For any event logged through the ActivityLogger, reading the events file should return
   * an event list that includes an event with matching type and data.
   */
  it('Property 8: logged events can be read back from file', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.option(fc.record({
          someField: fc.string(),
          someNumber: fc.integer(),
          someBoolean: fc.boolean(),
          nestedObject: fc.option(fc.record({
            nested1: fc.string(),
            nested2: fc.integer()
          }), { nil: undefined })
        }), { nil: undefined }),
        async (eventType, eventData) => {
          // Log an event with arbitrary type and data
          await logger.logEvent(eventType, eventData)
          
          // Read back the events
          const events = await logger.readEvents()
          
          // Find the event we just logged
          const found = events.find(e => 
            e.type === eventType && 
            JSON.stringify(e.data) === JSON.stringify(eventData)
          )
          
          // Verify the event exists in the read results
          expect(found).toBeDefined()
          expect(found?.type).toBe(eventType)
          expect(found?.data).toEqual(eventData)
        }
      ),
      { numRuns: 100 }
    )
  })
})
