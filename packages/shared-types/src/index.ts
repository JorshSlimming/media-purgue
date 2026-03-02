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

export interface UsuarioConfig {
  tamano_lote_imagenes: number
  tamano_lote_videos: number
  criterio: 'fecha_creacion' | 'tamano'
  nombre_biblioteca: string
  ubicacion_biblioteca: string
  incluir_subcarpetas: boolean
}

export interface LogEntry {
  tipo: 'mover' | 'copiar' | 'eliminar' | 'info' | 'error'
  ruta_origen?: string
  ruta_destino?: string
  tamano_bytes?: number
  mensaje?: string
  timestamp: string
}

export interface LogLote {
  lote_id: number
  tipo: 'imagenes' | 'videos'
  fecha_cierre: string
  conservados: number
  eliminados: number
  espacio_conservado_bytes: number
  espacio_liberado_bytes: number
  entradas: LogEntry[]
}

export interface GlobalSummary {
  procesos: number
  archivos_procesados: number
  conservados: number
  eliminados: number
  espacio_total_conservado_bytes: number
  espacio_total_liberado_bytes: number
  generado_en: string
}
