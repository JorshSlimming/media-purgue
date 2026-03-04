// Embedded sample data (previously samples/*.json). Kept minimal but compatible
const globalSample = {
  mpName: 'Media Purgue (Demo)',
  rootPath: '/mock/root',
  lotes: [
    { id: 'lote_0001', nombre: 'Lote 0001', ruta: '/mock/lotes/lote_0001.json' }
  ],
  summary: {}
}

const now = Date.now()
const loteSample = {
  id: 'lote_0001',
  nombre: 'Lote 0001',
  archivos: [
    { nombre: 'IMG_0001.jpg', tamano_bytes: 234567, fecha_modificacion: now - 1000 * 60 * 60 * 24, estado: 'pendiente', tipo: 'imagen', ruta_original: '/mock/photos/IMG_0001.jpg' },
    { nombre: 'VID_0002.mp4', tamano_bytes: 3456789, fecha_modificacion: now - 1000 * 60 * 60 * 48, estado: 'pendiente', tipo: 'video', ruta_original: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
    { nombre: 'IMG_0003.jpg', tamano_bytes: 123456, fecha_modificacion: now - 1000 * 60 * 60 * 72, estado: 'pendiente', tipo: 'imagen', ruta_original: '/mock/photos/IMG_0003.jpg' }
  ],
  metadata: { total: 3 }
}

const usuarioSample = { lang: 'es', prefs: {} }

type ProgressCb = (data: any) => void

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

const state: any = {
  mpRoot: '/mock/root',
  session: {},
  usuarioConfig: usuarioSample,
  logs: [
    { type: 'app:entry', data: { msg: 'Demo log 1' }, time: Date.now() - 10000 },
  ],
  staging: [],
}

const progressCbs: ProgressCb[] = []

function emitProgress(p: any) {
  for (const cb of progressCbs) cb(p)
}

const mp = {
  ping: async () => 'mp-mock',

  scanFolder: async (opts: any) => {
    await delay(200)
    // Return the shape expected by the renderer: { created: [lotePaths], counts: { images, videos } }
    return { created: ['/mock/lotes/lote_0001.json'], counts: { images: 3, videos: 1 } }
  },

  inspectFolder: async (opts: any) => {
    await delay(150)
    return { counts: { images: 3, videos: 1 } }
  },

  selectFolder: async () => {
    await delay(50)
    return '/mock/selected/folder'
  },

  readLote: async (lotePath: string) => {
    await delay(80)
    // Return the lote object directly (same shape as jsonManager.readLote)
    // Ensure archivos have accessible image URLs for the browser demo
    const archivos = (loteSample.archivos || []).map((f:any, idx:number) => {
      const isHttp = typeof f.ruta_original === 'string' && /^https?:\/\//i.test(f.ruta_original)
      if (isHttp) {
        // Keep remote URLs as-is for browser playback
        return { ...f }
      }
      // For images use smaller picsum sizes to speed up demo loading
      const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(f.nombre)
      const url = isImg
        ? `https://picsum.photos/seed/${encodeURIComponent(f.nombre)}/400/300`
        : `https://picsum.photos/seed/${encodeURIComponent(f.nombre)}/400/300`
      return { ...f, ruta_original: url }
    })
    return { ...loteSample, archivos }
  },

  updateArchivoEstado: async (args: any) => {
    await delay(20)
    try {
      // args: { lotePath, orden, nuevoEstado }
      const { orden, nuevoEstado } = args || {}
      if (typeof orden === 'number' && Array.isArray(loteSample.archivos) && loteSample.archivos[orden]) {
        loteSample.archivos[orden].estado = nuevoEstado
        return { ok: true }
      }
      return { ok: false, error: 'invalid args' }
    } catch (err:any) {
      return { ok: false, error: String(err) }
    }
  },

  closeLote: async (lotePath: string) => {
    await delay(200)
    // compute conservados/eliminados from current loteSample state
    const conservados = (loteSample.archivos || []).filter((f:any) => f.estado === 'conservar').length
    const eliminados = (loteSample.archivos || []).filter((f:any) => f.estado === 'eliminar').length
    // emit progress to simulate background work
    let i = 0
    const t = setInterval(() => {
      i += 25
      emitProgress({ type: 'closeLote:progress', lotePath, progress: Math.min(i, 100) })
      if (i >= 100) {
        clearInterval(t)
        emitProgress({ type: 'closeLote:finished', lotePath, conservados, eliminados })
      }
    }, 180)
    return { ok: true, conservados, eliminados }
  },

  listStaging: async (root: string) => {
    await delay(30)
    return { ok: true, entries: state.staging }
  },

  revealPath: async (p: string) => {
    await delay(10)
    return { ok: true }
  },

  onProgress: (cb: ProgressCb) => {
    progressCbs.push(cb)
    return () => {
      const idx = progressCbs.indexOf(cb)
      if (idx >= 0) progressCbs.splice(idx, 1)
    }
  },

  finalizeLibrary: async (mpRoot: string, opts?: any) => {
    await delay(300)
    emitProgress({ action: 'finalizeLibrary', progress: 100 })
    return { ok: true }
  },

  readLog: async (mpRoot: string | null, fileName?: string) => {
    await delay(40)
    return { ok: true, log: state.logs }
  },

  listLogs: async (mpRoot: string) => {
    await delay(30)
    return { ok: true, files: ['app.log.json'] }
  },

  appendAppLog: async (mpRoot: string, entry: any) => {
    await delay(10)
    state.logs.push({ type: entry?.type || 'app:entry', data: entry?.data ?? entry, time: Date.now() })
    return { ok: true }
  },

  saveUsuarioConfig: async (rootPath: string, usuarioConfig: any) => {
    await delay(20)
    state.usuarioConfig = usuarioConfig
    return { ok: true }
  },

  saveSession: async (rootPath: string, session: any) => {
    await delay(10)
    state.session = session
    return { ok: true }
  },

  loadSession: async (rootPath: string) => {
    await delay(10)
    return { ok: true, session: state.session }
  },

  readAppLog: async (mpRoot: string) => {
    await delay(20)
    return { ok: true, entries: state.logs }
  },
}

export default mp

declare global {
  interface Window { mp?: any }
}

if (typeof window !== 'undefined' && !window.mp) {
  window.mp = mp
}
