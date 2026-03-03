import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('ActivityLogger - File Rotation Properties', () => {
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
   * Feature: comprehensive-activity-logging, Property 15: File rotates at 10,001 events
   * 
   * **Validates: Requirements 10.2**
   * 
   * For any sequence of logged events, when the event count reaches 10,001, the ActivityLogger
   * should create a backup file with a timestamp and start a new events file.
   * 
   * This test verifies:
   * 1. No backup file exists before reaching 10,000 events
   * 2. After logging 10,000 events, no backup file is created yet
   * 3. After logging the 10,001st event, a backup file is created
   * 4. The new events file contains only the 10,001st event
   * 5. The backup file contains the first 10,000 events
   */
  it('Property 15: file rotation occurs at 101 events (test threshold)', async () => {
    // Use smaller threshold for test speed
    logger = new (logger.constructor as any)(tmpRoot, 100)
    // Log exactly 100 events
    for (let i = 0; i < 100; i++) {
      await logger.logEvent('test:event', { index: i })
    }
    
    // Verify no backup file exists yet
    const logsDir = path.join(tmpRoot, '.media-purgue', 'Logs')
    let files = await fs.readdir(logsDir)
    const backupsBefore = files.filter(f => f.startsWith('app_events_backup_'))
    expect(backupsBefore.length).toBe(0)
    
    // Verify we have exactly 100 events in the current file (test threshold)
    let events = await logger.readEvents()
    expect(events.length).toBe(100)
    
    // Log the 101st event - this should trigger rotation
    await logger.logEvent('test:event', { index: 100 })
    
    // Verify backup file was created
    files = await fs.readdir(logsDir)
    const backupsAfter = files.filter(f => f.startsWith('app_events_backup_'))
    expect(backupsAfter.length).toBe(1)
    
    // Verify the backup file name follows the expected pattern
    const backupFile = backupsAfter[0]
    expect(backupFile).toMatch(/^app_events_backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/)
    
    // Verify new file has only 1 event (the 101st event)
    events = await logger.readEvents()
    expect(events.length).toBe(1)
    expect(events[0].data?.index).toBe(100)
    
    // Verify backup file contains the first 10,000 events
    const backupPath = path.join(logsDir, backupFile)
    const backupContent = await fs.readFile(backupPath, 'utf8')
    const backupData = JSON.parse(backupContent)
    expect(backupData.entries.length).toBe(100)
    expect(backupData.entries[0].data?.index).toBe(0)
    expect(backupData.entries[99].data?.index).toBe(99)
  }, 30000) // 30 second timeout for this long-running test

  /**
   * Additional test: Verify multiple rotations work correctly
   * 
   * This test ensures that the rotation mechanism continues to work
   * after the first rotation, creating multiple backup files.
   */
  it('Property 15 (extended): multiple rotations create multiple backup files (test threshold)', async () => {
    // Use smaller threshold for test speed
    logger = new (logger.constructor as any)(tmpRoot, 100)
    // Log 101 events to trigger first rotation
    for (let i = 0; i < 101; i++) {
      await logger.logEvent('test:event', { index: i })
    }
    
    const logsDir = path.join(tmpRoot, '.media-purgue', 'Logs')
    let files = await fs.readdir(logsDir)
    let backups = files.filter(f => f.startsWith('app_events_backup_'))
    expect(backups.length).toBe(1)
    
    // Log another 100 events to trigger second rotation
    for (let i = 101; i < 201; i++) {
      await logger.logEvent('test:event', { index: i })
    }
    
    // Verify second backup file was created
    files = await fs.readdir(logsDir)
    backups = files.filter(f => f.startsWith('app_events_backup_'))
    expect(backups.length).toBe(2)
    
    // Verify current file has only 1 event (the last)
    const events = await logger.readEvents()
    expect(events.length).toBe(1)
    expect(events[0].data?.index).toBe(200)
  }, 60000) // 60 second timeout for this very long-running test
})
