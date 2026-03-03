import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

/**
 * Represents a single activity event in the application
 */
export interface ActivityEvent {
  id: string                    // UUID v4
  timestamp: string             // ISO 8601
  type: string                  // Event type (e.g., "button:selectFolder")
  data?: Record<string, any>    // Event-specific data
  error?: {                     // Optional error information
    message: string
    stack?: string
  }
}

/**
 * Structure of the app_events.json file
 */
export interface AppEventsFile {
  entries: ActivityEvent[]
}

/**
 * ActivityLogger service for managing application activity events
 * 
 * Responsibilities:
 * - Append events to app_events.json asynchronously
 * - Generate unique event IDs (UUID v4)
 * - Add ISO 8601 timestamps to events
 * - Implement file rotation at 10,000 events
 * - Provide error handling for file system operations
 */
export class ActivityLogger {
  private readonly eventsFilePath: string
  private readonly logsDir: string
  /** Serializes concurrent appends to avoid race-condition corruption */
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private mpRoot: string, private rotationThreshold = 10000) {
    this.logsDir = path.join(mpRoot, '.media-purgue', 'Logs')
    this.eventsFilePath = path.join(this.logsDir, 'app_events.json')
  }

  /**
   * Append a new event to the log
   * @param type Event type identifier
   * @param data Optional event-specific data
   */
  async logEvent(type: string, data?: Record<string, any>): Promise<void> {
    const event: ActivityEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      data
    }

    await this.appendEvent(event)
  }

  /**
   * Log an error event with stack trace
   * @param type Error event type identifier
   * @param error Error object
   * @param data Optional additional context data
   */
  async logError(type: string, error: Error, data?: Record<string, any>): Promise<void> {
    const event: ActivityEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      data,
      error: {
        message: error.message,
        stack: error.stack
      }
    }

    await this.appendEvent(event)
  }

  /**
   * Read all events from the log
   * @returns Array of activity events
   */
  async readEvents(): Promise<ActivityEvent[]> {
    try {
      const raw = await fs.readFile(this.eventsFilePath, 'utf8')
      const parsed: AppEventsFile = JSON.parse(raw)
      return parsed.entries || []
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // File doesn't exist - return empty array
        return []
      }
      if (err instanceof SyntaxError) {
        // JSON parsing failed - attempt recovery
        console.error('Corrupted events file, attempting recovery')
        return await this.attemptLineByLineRecovery()
      }
      throw err
    }
  }

  /**
   * Append an event to the log file with rotation check.
   * Uses a write queue to serialize concurrent calls and avoid corruption.
   */
  private appendEvent(event: ActivityEvent): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(() => this._appendEventInternal(event))
      .catch(() => this._appendEventInternal(event))
    return this.writeQueue
  }

  private async _appendEventInternal(event: ActivityEvent): Promise<void> {
    // Check if rotation is needed before appending
    await this.rotateIfNeeded()

    // Ensure logs directory exists
    await fs.mkdir(this.logsDir, { recursive: true })

    // Read existing events
    let eventsFile: AppEventsFile
    try {
      const raw = await fs.readFile(this.eventsFilePath, 'utf8')
      eventsFile = JSON.parse(raw)
      if (!eventsFile.entries) {
        eventsFile.entries = []
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // File doesn't exist - create new structure
        eventsFile = { entries: [] }
      } else if (err instanceof SyntaxError) {
        // Corrupted file - recover what we can
        console.error('Corrupted events file on write, attempting recovery')
        const recovered = await this.attemptLineByLineRecovery()
        // Rewrite clean file
        await this.writeWithRetry(this.eventsFilePath, JSON.stringify({ entries: recovered }, null, 2))
        eventsFile = { entries: recovered }
      } else {
        throw err
      }
    }

    // Append new event
    eventsFile.entries.push(event)

    // Write back to file with retry logic
    await this.writeWithRetry(this.eventsFilePath, JSON.stringify(eventsFile, null, 2))
  }

  /**
   * Rotate log file if it exceeds threshold (10,000 events)
   */
  private async rotateIfNeeded(): Promise<void> {
    const eventCount = await this.getEventCount()
    
    if (eventCount >= this.rotationThreshold) {
      // Create backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(this.logsDir, `app_events_backup_${timestamp}.json`)
      
      try {
        // Rename current file to backup
        await fs.rename(this.eventsFilePath, backupPath)
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          throw err
        }
        // File doesn't exist, no need to rotate
      }
    }
  }

  /**
   * Get current event count from the log file
   * @returns Number of events in the current log file
   */
  private async getEventCount(): Promise<number> {
    try {
      const raw = await fs.readFile(this.eventsFilePath, 'utf8')
      const parsed: AppEventsFile = JSON.parse(raw)
      return parsed.entries?.length || 0
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return 0
      }
      throw err
    }
  }

  /**
   * Write file with retry logic and exponential backoff
   * @param filePath Path to write to
   * @param data Data to write
   * @param maxRetries Maximum number of retry attempts
   */
  private async writeWithRetry(filePath: string, data: string, maxRetries = 3): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fs.writeFile(filePath, data, 'utf8')
        return
      } catch (err: any) {
        if (attempt === maxRetries - 1) throw err
        if (err.code === 'ENOSPC') throw err  // Don't retry on disk full
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
      }
    }
  }

  /**
   * Attempt to recover events from a corrupted JSON file.
   * Strategy 1: extract entries array from the outer { "entries": [...] } wrapper.
   * Strategy 2: regex-scan for individual event objects with id+timestamp+type.
   */
  private async attemptLineByLineRecovery(): Promise<ActivityEvent[]> {
    try {
      const raw = await fs.readFile(this.eventsFilePath, 'utf8')

      // Strategy 1: find "entries": [...] and try JSON.parse on the array portion
      const bracketStart = raw.indexOf('[')
      if (bracketStart !== -1) {
        // Walk backwards from end to find the last complete ']'
        for (let end = raw.length - 1; end > bracketStart; end--) {
          if (raw[end] === ']') {
            try {
              const candidate = raw.slice(bracketStart, end + 1)
              const arr = JSON.parse(candidate)
              if (Array.isArray(arr)) {
                return arr.filter((e: any) => e && e.id && e.timestamp && e.type)
              }
            } catch { /* try shorter substring */ }
          }
        }
      }

      // Strategy 2: regex-extract individual event objects
      const events: ActivityEvent[] = []
      // Match objects that start with "id": and contain timestamp + type fields
      const objectRegex = /\{[^{}]*"id"\s*:\s*"[^"]+"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gs
      let match: RegExpExecArray | null
      while ((match = objectRegex.exec(raw)) !== null) {
        try {
          const parsed = JSON.parse(match[0])
          if (parsed.id && parsed.timestamp && parsed.type) {
            events.push(parsed)
          }
        } catch { /* skip unparseable fragments */ }
      }
      return events
    } catch {
      return []
    }
  }
}
