import path from 'path'
import { ensureDir } from './fsManager'

export async function ensureStaging(root: string) {
  const staging = path.join(root, '02_Biblioteca_Final', '.staging')
  await ensureDir(staging)
  return staging
}

// Placeholder for staging operations (copy/move with rollback)
