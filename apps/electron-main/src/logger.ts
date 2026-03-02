import fs from 'fs/promises'
import path from 'path'

export async function writeLogJSON(dir: string, name: string, data: any) {
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, name)
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8')
}

export async function readLogJSON(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
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
