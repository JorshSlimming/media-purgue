import fs from 'fs/promises'
import path from 'path'
import { ActivityLogger } from './activityLogger'

export async function writeLogJSON(dir: string, name: string, data: any, logger?: ActivityLogger) {
  try {
    await fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, name)
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8')
  } catch (err: any) {
    try { if (logger) await logger.logError('error:writeLogJSON', err, { dir, name }) } catch (_) {}
    throw err
  }
}

export async function readLogJSON(filePath: string, logger?: ActivityLogger) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (err: any) {
    try { if (logger) await logger.logError('error:readLogJSON', err, { filePath }) } catch (_) {}
    return null
  }
}

export async function listLogs(dir: string) {
  try {
    const files = await fs.readdir(dir)
    return files.filter(f => f.endsWith('.log') || f.endsWith('.json'))
  } catch (err) {
    return []
  }
}
