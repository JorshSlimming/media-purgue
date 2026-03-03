import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron'
import { dialog } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import { BrowserWindow as BW } from 'electron'
import { Readable } from 'stream'
import ffmpegFluent from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { scanMediaFiles, ensureDir, writeJsonAtomic, copyFile, moveFile, unlinkFile } from './fsManager'
import { readJson } from './fsManager'
import { readLote, writeLote, Lote } from './jsonManager'
import { ensureStaging } from './stagingManager'
import { writeLogJSON, readLogJSON, listLogs } from './logger'
import fs from 'fs'
import fsExtra from 'fs-extra'
import os from 'os'
import { getActivityLogger } from './loggerRegistry'
import { setNotifier } from './progressNotifier'
import { appendAppLogHandler, readAppLogHandler } from './ipcHandlers'
import { updateArchivoEstadoHandler } from './handlers/updateArchivoEstado'
import { saveUsuarioConfigHandler } from './handlers/saveUsuarioConfig'
import { saveSessionHandler, loadSessionHandler } from './handlers/session'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

if (ffmpegStatic) {
  ffmpegFluent.setFfmpegPath(ffmpegStatic)
}

const VIDEO_TRANSCODE_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv'])

function sendProgress(payload: any) {
  const win = BW.getAllWindows()[0]
  if (win) win.webContents.send('mp:progress', payload)
}

// expose sendProgress to other modules via progressNotifier
setNotifier((p: any) => {
  try { sendProgress(p) } catch (_) {}
})

// Development: disable GPU to avoid Windows Chromium cache/GPU disk errors
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
// Force userData to a project-local folder to ensure write permissions during dev, unless running E2E
if (process.env.MP_E2E) {
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'mp-e2e-profile-')))
} else {
  app.setPath('userData', path.join(process.cwd(), '.electron-user-data'))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  })

  // In dev this can point to localhost vite server
  // allow overriding renderer URL via env for tests (e.g. static server)
  const rendererUrl = process.env.MP_RENDERER_URL || 'http://localhost:5173/'
  win.loadURL(rendererUrl)
  // Ensure the native menu bar is hidden (useful on Windows/Linux)
  try {
    win.setAutoHideMenuBar(true)
    win.setMenuBarVisibility(false)
  } catch (_) {}
}

app.whenReady().then(() => {
  protocol.handle('media', async (request) => {
    try {
      const parsed = new URL(request.url)
      const queryPath = parsed.searchParams.get('path')
      const encodedPath = request.url.replace(/^media:\/\//i, '')
      let filePath = queryPath ? decodeURIComponent(queryPath) : decodeURIComponent(encodedPath)

      if (/^\/[a-zA-Z]:[\\/]/.test(filePath)) {
        filePath = filePath.slice(1)
      }

      if (process.platform === 'win32') {
        filePath = filePath.replace(/\//g, '\\')
      }

      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 })
      }

      const ext = path.extname(filePath).toLowerCase()

      if (VIDEO_TRANSCODE_EXTS.has(ext)) {
        // Transcode proprietary codec (H.264/AAC) → WebM VP8/Vorbis on the fly
        // because Electron's Chromium build doesn't include H.264 licence
        const nodeStream = ffmpegFluent(filePath)
          .format('webm')
          .videoCodec('libvpx')
          .audioCodec('libvorbis')
          .outputOptions(['-deadline realtime', '-cpu-used 8', '-b:v 1500k'])
          .on('error', (err: Error) => {
              try {
                // attempt to locate nearest .media-purgue for project context
                function findMediaPurgueAncestor(fp: string) {
                  let dir = path.dirname(fp)
                  const root = path.parse(dir).root
                  while (dir && dir !== root) {
                    const candidate = path.join(dir, '.media-purgue')
                    if (fs.existsSync(candidate)) return candidate
                    dir = path.dirname(dir)
                  }
                  return null
                }
                const mpRoot = findMediaPurgueAncestor(filePath)
                if (mpRoot) {
                  const projectRoot = path.resolve(mpRoot, '..')
                  try {
                    const logger = getActivityLogger(projectRoot)
                    logger.logError('error:mediaProtocol', err, { file: filePath }).catch(() => {})
                  } catch (_) {}
                }
              } catch (_) {}
              console.error('[media protocol] ffmpeg transcode error:', err.message)
            })
          .pipe() as NodeJS.ReadableStream

        const webStream = new ReadableStream({
          start(controller) {
            nodeStream.on('data', (chunk: Buffer) => controller.enqueue(chunk))
            nodeStream.on('end', () => controller.close())
            nodeStream.on('error', (err: Error) => controller.error(err))
          },
          cancel() {
            (nodeStream as Readable).destroy()
          }
        })

        return new Response(webStream, {
          status: 200,
          headers: {
            'Content-Type': 'video/webm',
            'Cache-Control': 'no-cache'
          }
        })
      }

      // Images and native WebM: serve directly via file:// with range support
      const fileUrl = pathToFileURL(filePath).toString()
      return net.fetch(fileUrl, {
        method: request.method,
        headers: request.headers
      })
    } catch (error: any) {
      console.error('[media protocol] Error:', error)
      return new Response(`Error: ${error.message}`, { status: 500 })
    }
  })

  createWindow()
  // delegate to testable handler implementations
  ipcMain.handle('mp:appendAppLog', async (evt, rootPath: string, entry: any) => appendAppLogHandler(rootPath, entry))
  ipcMain.handle('mp:readAppLog', async (evt, rootPath: string, filters?: { types?: string[]; searchText?: string }) => readAppLogHandler(rootPath, filters))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers will be added here (scan, readLote, closeLote...)
ipcMain.handle('ping', async () => 'pong')

ipcMain.handle('mp:scanFolder', async (evt, opts) => {
  const { rootPath, includeSubfolders = true, usuarioConfig } = opts || {}
  if (!rootPath) throw new Error('rootPath required')

  // create .media-purgue structure
  const mpRoot = path.join(rootPath, '.media-purgue')
  const proc = path.join(mpRoot, '01_Procesando')
  const final = path.join(mpRoot, '02_Biblioteca_Final')
  const configDir = path.join(mpRoot, 'Config')
  const logsDir = path.join(mpRoot, 'Logs')
  await ensureDir(proc)
  await ensureDir(final)
  await ensureDir(configDir)
  await ensureDir(logsDir)

  // save usuario.json
  const configPath = path.join(configDir, 'usuario.json')
  const scanLogger = getActivityLogger(rootPath)
  // non-blocking: attempt to record that a scan started
  scanLogger.logEvent('scan:starting', { includeSubfolders, usuarioConfig }).catch(() => {})
  await writeJsonAtomic(configPath, usuarioConfig || {
    tamano_lote_imagenes: 100,
    tamano_lote_videos: 30,
    criterio: 'fecha_creacion',
    nombre_biblioteca: 'Biblioteca_Final',
    ubicacion_biblioteca: '../',
    incluir_subcarpetas: true
  }, scanLogger)

  try {
    const scanned = await scanMediaFiles(rootPath, includeSubfolders)

    // emit progress: scanned counts
    try {
      sendProgress({ type: 'scan:counts', counts: { images: scanned.images.length, videos: scanned.videos.length } })
    } catch (_) { }

    // create simple lotes: split arrays into chunks and write them progressively
    function chunk<T>(arr: T[], size: number) {
      const out: T[][] = []
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
      return out
    }

    const imageChunks = chunk(scanned.images, (usuarioConfig?.tamano_lote_imagenes) || 100)
    const videoChunks = chunk(scanned.videos, (usuarioConfig?.tamano_lote_videos) || 30)

    // helper to write lote dirs progressively (non-blocking yields)
    let idCounter = 1
    const created: string[] = []

    async function makeLotes(chunks: string[][], tipo: 'imagenes' | 'videos') {
      for (let i = 0; i < chunks.length; i++) {
        const files = chunks[i] || []
        const loteDir = path.join(proc, `${tipo}_Lote_${String(idCounter).padStart(4, '0')}`)
        await ensureDir(loteDir)
        const lotePath = path.join(loteDir, `lote_${String(idCounter).padStart(4, '0')}.json`)
        const lote: Lote = {
          lote_id: idCounter,
          tipo,
          criterio: usuarioConfig?.criterio || 'fecha_creacion',
          fecha_creacion: new Date().toISOString(),
          archivos: files.map((f: string, idx: number) => ({
            nombre: path.basename(f),
            ruta_original: f,
            tamano_bytes: fs.statSync(f).size,
            fecha_modificacion: fs.statSync(f).mtime.toISOString(),
            estado: 'pendiente' as 'pendiente',
            orden: idx + 1
          }))
        }
        await writeLote(lotePath, lote, scanLogger)
        created.push(lotePath)
        // progress + activity log for lote created
        try { sendProgress({ type: 'scan:loteCreated', lotePath, loteId: idCounter }) } catch (_) { }
        scanLogger.logEvent('scan:loteCreated', { lotePath, loteId: idCounter, tipo }).catch(() => {})
        idCounter++
        // yield to event loop to avoid blocking heavy scans
        await new Promise(r => setTimeout(r, 0))
      }
    }

    // start generating lotes for both types; do not await both sequentially to allow interleaving
    await makeLotes(imageChunks as any, 'imagenes')
    await makeLotes(videoChunks as any, 'videos')

    try { sendProgress({ type: 'scan:done', createdCount: created.length }) } catch (_) { }
    scanLogger.logEvent('scan:done', { createdCount: created.length, counts: { images: scanned.images.length, videos: scanned.videos.length } }).catch(() => {})
    return { created, counts: { images: scanned.images.length, videos: scanned.videos.length } }
  } catch (err: any) {
    // record errors related to the scan process but do not throw away error details
    try { scanLogger.logError('error:scanFolder', err, { rootPath }).catch(() => {}) } catch (_) {}
    throw err
  }
})

ipcMain.handle('mp:inspectFolder', async (evt, opts) => {
  const { rootPath, includeSubfolders = true } = opts || {}
  if (!rootPath) throw new Error('rootPath required')
  const scanned = await scanMediaFiles(rootPath, includeSubfolders)
  return { counts: { images: scanned.images.length, videos: scanned.videos.length } }
})

ipcMain.handle('mp:selectFolder', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (res.canceled) return null
  return res.filePaths[0]
})

ipcMain.handle('mp:readLote', async (evt, lotePath: string) => {
  if (!lotePath) return null
  return readLote(lotePath)
})

ipcMain.handle('mp:updateArchivoEstado', async (evt, args) => updateArchivoEstadoHandler(args))

ipcMain.handle('mp:listStaging', async (evt, root: string) => {
  const staging = path.join(root, '.media-purgue', '02_Biblioteca_Final', '.staging')
  try {
    const files = await fs.promises.readdir(staging)
    return { staging, files }
  } catch (err) {
    return { staging, files: [] }
  }
})

import { closeLote as implCloseLote } from './closeLote'

ipcMain.handle('mp:closeLote', async (evt, lotePath: string) => {
  if (!lotePath) return { ok: false, error: 'lotePath required' }
  // try to read lote to obtain id and mpRoot for better error info
  let loteObj: any = null
  try { loteObj = await readLote(lotePath) } catch (_) { loteObj = null }
  const loteId = loteObj?.lote_id
  const loteDir = path.dirname(lotePath)
  const mpRoot = path.resolve(loteDir, '..', '..')
  const staging = path.join(mpRoot, '.media-purgue', '02_Biblioteca_Final', '.staging')
  const logFile = loteId ? path.join(mpRoot, 'Logs', `lote_${loteId}.json`) : null

  try {
    const res = await implCloseLote(lotePath)
    // If the close process auto-finalized the library, notify renderer via progress channel
    try {
      if (res && (res as any).autoFinalized) {
        try { sendProgress({ type: 'finalize:autoFinished', data: (res as any).autoFinalized }) } catch (_) {}
      }
    } catch (_) {}
    // if impl returns non-ok, augment with staging/log info
    if (res && res.ok === false) {
      return { ...res, staging, log: logFile }
    }
    return res
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err), staging, log: logFile }
  }
})

// list and read logs
ipcMain.handle('mp:listLogs', async (evt, mpRoot: string) => {
  const logsDir = path.join(mpRoot, 'Logs')
  return listLogs(logsDir)
})

ipcMain.handle('mp:readLog', async (evt, mpRoot: string, fileName: string) => {
  const fp = path.join(mpRoot, 'Logs', fileName)
  return readLogJSON(fp)
})

ipcMain.handle('mp:saveUsuarioConfig', async (evt, rootPath: string, usuarioConfig: any) => {
  return saveUsuarioConfigHandler(rootPath, usuarioConfig)
})

ipcMain.handle('mp:saveSession', async (evt, rootPath: string, session: any) => {
  return saveSessionHandler(rootPath, session)
})

ipcMain.handle('mp:loadSession', async (evt, rootPath: string) => {
  return loadSessionHandler(rootPath)
})

import { finalizeLibrary } from './finalizeLibrary'

ipcMain.handle('mp:finalizeLibrary', async (evt, mpRoot: string) => {
  return finalizeLibrary(mpRoot)
})

ipcMain.handle('mp:revealPath', async (evt, targetPath: string) => {
  if (!targetPath) return { ok: false, error: 'path required' }
  try {
    // show parent folder and select file if exists
    const stat = await fs.promises.stat(targetPath).catch(() => null)
    if (stat && stat.isFile()) {
      await shell.showItemInFolder(targetPath)
      return { ok: true }
    }
    // otherwise open folder
    await shell.openPath(targetPath)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
})
