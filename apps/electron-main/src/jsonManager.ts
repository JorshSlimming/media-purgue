import { readJson, ensureDir, writeJsonAtomic } from './fsManager'
import path from 'path'

export interface LoteArchivo {
  nombre: string
  ruta_original: string
  tamano_bytes: number
  fecha_modificacion: string
  estado: 'pendiente' | 'conservar' | 'eliminar'
  orden: number
}

export interface Lote {
  lote_id: number
  tipo: 'imagenes' | 'videos'
  criterio: string
  fecha_creacion: string
  archivos: LoteArchivo[]
}

export async function readLote(filePath: string): Promise<Lote | null> {
  return readJson<Lote>(filePath)
}

export async function writeLote(filePath: string, lote: Lote) {
  await ensureDir(path.dirname(filePath))
  await writeJsonAtomic(filePath, lote)
}

