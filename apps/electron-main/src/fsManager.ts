import fs from 'fs'
import path from 'path'
import fsp from 'fs/promises'
import { Dirent } from 'fs'
import fsExtra from 'fs-extra'

export async function ensureDir(dirPath: string) {
  await fsp.mkdir(dirPath, { recursive: true })
}

export function existsSync(p: string) {
  return fs.existsSync(p)
}

export async function readJson<T = any>(filePath: string): Promise<T | null> {
  try {
    const raw = await fsp.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch (err) {
    return null
  }
}

export async function writeJsonAtomic(filePath: string, data: any) {
  const tmp = `${filePath}.tmp`
  await ensureDir(path.dirname(filePath))
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fsp.rename(tmp, filePath)
}

export async function copyFile(src: string, dest: string) {
  await ensureDir(path.dirname(dest))
  await fsExtra.copy(src, dest, { overwrite: false, errorOnExist: false })
}

export async function moveFile(src: string, dest: string) {
  await ensureDir(path.dirname(dest))
  await fsExtra.move(src, dest, { overwrite: false })
}

export async function unlinkFile(p: string) {
  try {
    await fsp.unlink(p)
  } catch (err) {
    // ignore
  }
}

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp', '.tiff']
const VIDEO_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg']

export async function scanMediaFiles(root: string, includeSubfolders = true) {
  const images: string[] = []
  const videos: string[] = []

  async function walk(dir: string) {
    let entries: Dirent[]
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch (err) {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (includeSubfolders) await walk(full)
        continue
      }
      const ext = path.extname(e.name).toLowerCase()
      if (IMAGE_EXT.includes(ext)) images.push(full)
      else if (VIDEO_EXT.includes(ext)) videos.push(full)
    }
  }

  await walk(root)
  return { images, videos }
}

// more helpers (copy/move/delete) will go here
