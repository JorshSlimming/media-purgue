export type ScanOpts = {
  rootPath: string
  includeSubfolders?: boolean
  usuarioConfig?: any
}
function getMp() {
  return (window as any).mp
}

function has(name: string) {
  const m = getMp()
  return !!m && typeof m[name] === 'function'
}

export async function ping(): Promise<string> {
  if (!has('ping')) return Promise.resolve('mp-not-available')
  return getMp().ping()
}

export async function scanFolder(opts: ScanOpts) {
  if (!has('scanFolder')) return Promise.reject(new Error('IPC not available'))
  return getMp().scanFolder(opts)
}

export async function inspectFolder(opts: { rootPath: string; includeSubfolders?: boolean }) {
  if (!has('inspectFolder')) return Promise.reject(new Error('IPC not available'))
  return getMp().inspectFolder(opts)
}

export async function selectFolder() {
  if (!has('selectFolder')) return Promise.reject(new Error('IPC not available'))
  return getMp().selectFolder()
}

export async function readLote(lotePath: string) {
  if (!has('readLote')) return Promise.reject(new Error('IPC not available'))
  return getMp().readLote(lotePath)
}

export async function updateArchivoEstado(args: { lotePath: string; orden: number; nuevoEstado: 'pendiente' | 'conservar' | 'eliminar' }) {
  if (!has('updateArchivoEstado')) return Promise.reject(new Error('IPC not available'))
  return getMp().updateArchivoEstado(args)
}

export async function closeLote(lotePath: string) {
  if (!has('closeLote')) return Promise.reject(new Error('IPC not available'))
  return getMp().closeLote(lotePath)
}

export async function listStaging(root: string) {
  if (!has('listStaging')) return Promise.reject(new Error('IPC not available'))
  return getMp().listStaging(root)
}

export async function revealPath(p: string) {
  if (!has('revealPath')) return Promise.reject(new Error('IPC not available'))
  return getMp().revealPath(p)
}

export function onProgress(cb: (data: any) => void) {
  if (!has('onProgress')) {
    // running in browser/dev server - provide noop unsubscribe
    return () => { }
  }
  return getMp().onProgress(cb)
}

export async function finalizeLibrary(mpRoot: string, opts?: { lang?: string }) {
  if (!has('finalizeLibrary')) return Promise.reject(new Error('IPC not available'))
  return getMp().finalizeLibrary(mpRoot, opts)
}

// convenience wrapper to read a log JSON file by full path
export async function readLog(fullPathOrMpRoot: string, fileName?: string) {
  if (!has('readLog')) return Promise.reject(new Error('IPC not available'))
  if (fileName) return getMp().readLog(fullPathOrMpRoot, fileName)
  return getMp().readLog(null, fullPathOrMpRoot)
}

export async function listLogs(mpRoot: string) {
  if (!has('listLogs')) return Promise.reject(new Error('IPC not available'))
  return getMp().listLogs(mpRoot)
}

export async function appendAppLog(mpRoot: string, entry: any) {
  if (!has('appendAppLog')) return Promise.reject(new Error('IPC not available'))
  return getMp().appendAppLog(mpRoot, entry)
}

export async function saveUsuarioConfig(rootPath: string, usuarioConfig: any) {
  if (!has('saveUsuarioConfig')) return Promise.reject(new Error('IPC not available'))
  return getMp().saveUsuarioConfig(rootPath, usuarioConfig)
}

export async function saveSession(rootPath: string, session: any) {
  if (!has('saveSession')) return Promise.reject(new Error('IPC not available'))
  return getMp().saveSession(rootPath, session)
}

export async function loadSession(rootPath: string) {
  if (!has('loadSession')) return Promise.reject(new Error('IPC not available'))
  return getMp().loadSession(rootPath)
}

export async function readAppLog(mpRoot: string) {
  if (!has('readAppLog')) return Promise.reject(new Error('IPC not available'))
  return getMp().readAppLog(mpRoot)
}
