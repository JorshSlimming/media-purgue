export type ScanOpts = {
  rootPath: string
  includeSubfolders?: boolean
  usuarioConfig?: any
}

export async function ping(): Promise<string> {
  return (window as any).mp.ping()
}

export async function scanFolder(opts: ScanOpts) {
  return (window as any).mp.scanFolder(opts)
}

export async function inspectFolder(opts: { rootPath: string; includeSubfolders?: boolean }) {
  return (window as any).mp.inspectFolder(opts)
}

export async function selectFolder() {
  return (window as any).mp.selectFolder()
}

export async function readLote(lotePath: string) {
  return (window as any).mp.readLote(lotePath)
}

export async function updateArchivoEstado(args: { lotePath: string; orden: number; nuevoEstado: 'pendiente' | 'conservar' | 'eliminar' }) {
  return (window as any).mp.updateArchivoEstado(args)
}

export async function closeLote(lotePath: string) {
  return (window as any).mp.closeLote(lotePath)
}

export async function listStaging(root: string) {
  return (window as any).mp.listStaging(root)
}

export async function revealPath(p: string) {
  return (window as any).mp.revealPath(p)
}

export function onProgress(cb: (data: any) => void) {
  return (window as any).mp.onProgress(cb)
}

// convenience wrapper to read a log JSON file by full path
export async function readLog(fullPathOrMpRoot: string, fileName?: string) {
  // if two args provided (mpRoot, filename) call readLog via preload
  if (fileName) return (window as any).mp.readLog(fullPathOrMpRoot, fileName)
  // otherwise assume full path and call readLog directly exposed in preload
  return (window as any).mp.readLog(null, fullPathOrMpRoot)
}
