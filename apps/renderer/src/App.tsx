import React, { useState } from 'react'
import { scanFolder, readLote, updateArchivoEstado, closeLote, inspectFolder, selectFolder, listStaging, revealPath, onProgress, finalizeLibrary, appendAppLog, readAppLog, saveUsuarioConfig, saveSession, loadSession } from './ipc'
import ConfigModal from './components/ConfigModal'
import LogViewer from './components/LogViewer'
import Swiper from './components/Swiper'
import LoteSummaryModal from './components/LoteSummaryModal'
import GlobalSummaryModal from './components/GlobalSummaryModal'
import ErrorBanner from './components/ErrorBanner'
import { useProgressStore } from './state/store'

export default function App() {
  const [rootPath, setRootPath] = useState('')
  const [includeSub, setIncludeSub] = useState(true)
  const [pendingUsuarioConfig, setPendingUsuarioConfig] = useState<any>(null)

  const [scanResult, setScanResult] = useState<any | null>(null)
  const [selectedLote, setSelectedLote] = useState<string | null>(null)
  const [loteData, setLoteData] = useState<any | null>(null)

  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [stagingInfo, setStagingInfo] = useState<{ staging: string; files: string[] } | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalCounts, setModalCounts] = useState<{ images: number; videos: number } | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [appEvents, setAppEvents] = useState<any[]>([])
  const liveMessages = useProgressStore(s => s.messages)
  const [loteList, setLoteList] = useState<Array<any>>([])
  const [closedLotes, setClosedLotes] = useState<string[]>([])
  const [showFinalizados, setShowFinalizados] = useState<boolean>(false)
  const [sortOption, setSortOption] = useState<string>('none')
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false)
  const [simpleMode, setSimpleMode] = useState<boolean>(true)
  const [simplePreview, setSimplePreview] = useState<any | null>(null)

  // Modals stats state
  const [loteStats, setLoteStats] = useState<{ id: string | number, conservados: number, eliminados: number, bytesConservados?: number, bytesEliminados?: number } | null>(null)
  const [globalStats, setGlobalStats] = useState<any | null>(null)
  const [showGlobalSummary, setShowGlobalSummary] = useState(false)
  const [finalDestino, setFinalDestino] = useState<string | null>(null)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)
  const [showCreateLotesModal, setShowCreateLotesModal] = useState(false)
  const [createLotesProgress, setCreateLotesProgress] = useState<{ total: number, created: number, percent: number, etaSeconds: number | null }>({ total: 0, created: 0, percent: 0, etaSeconds: null })
  const autoOpenFinalOnceRef = React.useRef(false)
  const scanProgressStartRef = React.useRef<number | null>(null)

  function formatBytes(bytes?: number) {
    if (!bytes && bytes !== 0) return ''
    const b = Number(bytes || 0)
    if (b < 1024) return `${b} B`
    const kb = b / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    const gb = mb / 1024
    return `${gb.toFixed(2)} GB`
  }

  function formatSeconds(sec: number) {
    if (!sec || sec <= 0) return '0s'
    const s = Math.round(sec)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}m ${r}s`
  }

  async function handleSelectFolder() {
    const p = await selectFolder()
    if (p) {
      autoOpenFinalOnceRef.current = false
      setRootPath(p)
      // Log folder selection event (non-blocking) and refresh persisted events
      try { appendAppLog(p, { type: 'button:selectFolder', data: { path: p } }).catch(() => {}) } catch (_) {}
      try { readAppLog(p).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
      setStatusMsg('Inspeccionando carpeta...')
      setScanResult(null)
      setLoteData(null)
      try {
        const info = await inspectFolder({ rootPath: p, includeSubfolders: includeSub })
        setStatusMsg(null)
        const counts = info.counts || { images: 0, videos: 0 }
        setModalCounts(counts)
        // Set default config locally to display summary
        if (!pendingUsuarioConfig) {
          setPendingUsuarioConfig({
            tamano_lote_imagenes: 100,
            tamano_lote_videos: 30,
            criterio: 'fecha_creacion',
            nombre_biblioteca: 'Biblioteca_Final',
            ubicacion_biblioteca: p,
            incluir_subcarpetas: true,
            secondsPerImage: 2.5,
            secondsPerVideo: 20
          })
        }
        // attempt to load previous session for this root
        try {
          const ses = await loadSession(p).catch(() => null)
          if (ses && ses.ok && ses.session) {
            const s = ses.session
            // restore usuarioConfig if present
            if (s.usuarioConfig) setPendingUsuarioConfig(s.usuarioConfig)
            // restore created lote list if present
            if (Array.isArray(s.created) && s.created.length > 0) {
              setScanResult({ created: s.created, counts: s.counts || counts })
              if (Array.isArray(s.closedLotes)) setClosedLotes(s.closedLotes)
            }
            // if session has an active lote, try to set it (do not auto-open)
            if (s.currentLote) {
              setSelectedLote(s.currentLote)
            }
          }
        } catch (_) {}
        const st = await listStaging(p)
        setStagingInfo(st)
      } catch (err: any) {
        setStatusMsg('Error inspeccionando: ' + (err.message || String(err)))
      }
    }
  }

  async function handleStartProcess() {
    // If we already have a scanResult (from session) consider this a "continue" action
    if (scanResult && Array.isArray(scanResult.created) && scanResult.created.length > 0) {
      // resume: open next unclosed lote (if simpleMode) or just show generated lotes
      if (simpleMode) {
        try {
          const entries: any[] = (loteList && loteList.length > 0) ? loteList : (scanResult?.created?.map((p:string, idx:number)=>({ path: p })) || [])
          const next = entries.find((e:any) => e.path && !closedLotes.includes(e.path))
          if (next) await openLote(next.path)
        } catch (_) {}
      }
      return
    }

    setStatusMsg('Generando lotes en segundo plano...')
    setShowCreateLotesModal(true)
    scanProgressStartRef.current = Date.now()
    const estimatedTotalLotes = Math.max(
      1,
      Math.ceil((modalCounts?.images ?? 0) / Math.max(1, pendingUsuarioConfig?.tamano_lote_imagenes ?? 100)) +
      Math.ceil((modalCounts?.videos ?? 0) / Math.max(1, pendingUsuarioConfig?.tamano_lote_videos ?? 30))
    )
    setCreateLotesProgress({ total: estimatedTotalLotes, created: 0, percent: 0, etaSeconds: null })
    try {
      // Log start process button with current pending config (non-blocking)
      try { if (rootPath) appendAppLog(rootPath, { type: 'button:startProcess', data: { config: pendingUsuarioConfig } }).catch(() => {}) } catch (_) {}
      try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
      const res = await scanFolder({ rootPath, includeSubfolders: pendingUsuarioConfig?.incluir_subcarpetas ?? true, usuarioConfig: pendingUsuarioConfig })
      setScanResult(res)
      // persist session: store usuarioConfig and created list
      try { if (rootPath) await saveSession(rootPath, { usuarioConfig: pendingUsuarioConfig, created: res.created, counts: res.counts || modalCounts, closedLotes: closedLotes || [] }).catch(() => {}) } catch (_) {}
      setStatusMsg(null)
      setShowCreateLotesModal(false)
      setCreateLotesProgress({ total: 0, created: 0, percent: 0, etaSeconds: null })
      scanProgressStartRef.current = null
    } catch (err: any) {
      setStatusMsg('Error generando lotes: ' + (err.message || String(err)))
      setShowCreateLotesModal(false)
      setCreateLotesProgress({ total: 0, created: 0, percent: 0, etaSeconds: null })
      scanProgressStartRef.current = null
    }
  }

  async function openLote(path: string) {
    setSelectedLote(path)
    const lote = await readLote(path)
    setLoteData(lote)
    // set current index to first pendiente file so resume doesn't start from the beginning
    try {
      const archivos = Array.isArray(lote?.archivos) ? lote.archivos : []
      const firstPending = archivos.findIndex((f: any) => f.estado === 'pendiente')
      setCurrentIndex(firstPending >= 0 ? firstPending : 0)
    } catch (_) {
      setCurrentIndex(0)
    }
    // Log navigation to open lote (non-blocking) and refresh persisted events
    try {
      if (rootPath) appendAppLog(rootPath, { type: 'navigation:openLote', data: { lotePath: path, loteId: lote?.lote_id } }).catch(() => {})
      try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
    } catch (_) {}
    // persist session: record current open lote
    try {
      if (rootPath) {
        const sess = { usuarioConfig: pendingUsuarioConfig, created: scanResult?.created || [], counts: scanResult?.counts || modalCounts || {}, closedLotes: closedLotes || [], currentLote: path }
        await saveSession(rootPath, sess).catch(() => {})
      }
    } catch (_) {}
  }

  function handleOpenConfigModal() {
    try { if (rootPath) appendAppLog(rootPath, { type: 'button:openConfig', data: {} }).catch(() => {}) } catch (_) {}
    try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
    setModalVisible(true)
  }

  function handleBackFromLote() {
    try { if (rootPath) appendAppLog(rootPath, { type: 'button:back', data: { loteId: loteData?.lote_id ?? null } }).catch(() => {}) } catch (_) {}
    try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
    setLoteData(null)
  }

  async function toggleEstado(orden: number, nuevo: 'conservar' | 'eliminar') {
    if (!selectedLote) return
    await updateArchivoEstado({ lotePath: selectedLote, orden, nuevoEstado: nuevo })
    const lote = await readLote(selectedLote)
    setLoteData(lote)
    // refresh metadata for this lote in the loteList so UI (progress) updates
    try {
      const meta = await (async (p: string) => {
        try {
          const lote = await readLote(p)
          const archivos = Array.isArray(lote?.archivos) ? lote.archivos : []
          const totalBytes = archivos.reduce((s:any,f:any) => s + (f.tamano_bytes || 0), 0)
          let oldestTs: number | null = null
          archivos.forEach((f:any) => {
            try { const t = f.fecha_modificacion ? new Date(f.fecha_modificacion).getTime() : null; if (t && (oldestTs === null || t < oldestTs)) oldestTs = t } catch (_) {}
          })
          const pendingCount = archivos.filter((f:any) => f.estado === 'pendiente').length
          const ready = closedLotes.includes(p)
          return { path: p, tipo: lote?.tipo, lote_id: lote?.lote_id, totalBytes, oldestTs, pendingCount, ready }
        } catch (_) { return { path: p } }
      })(selectedLote)
      setLoteList(prev => prev.map((it: any) => it.path === selectedLote ? meta : it))
      // persist session after state change
      try {
        if (rootPath) {
          const sess = { usuarioConfig: pendingUsuarioConfig, created: scanResult?.created || [], counts: scanResult?.counts || modalCounts || {}, closedLotes: closedLotes || [], currentLote: selectedLote }
          await saveSession(rootPath, sess).catch(() => {})
        }
      } catch (_) {}
    } catch (_) {}
  }

  async function handleCloseLote() {
    if (!selectedLote || !loteData) return
    setStatusMsg(`Cerrando lote ${loteData.lote_id}...`)
    setLastError(null)
    // compute sizes before closing (closeLote will remove originals)
    const keepFiles = (loteData.archivos || []).filter((f: any) => f.estado === 'conservar')
    const delFiles = (loteData.archivos || []).filter((f: any) => f.estado === 'eliminar')
    const keepBytes = keepFiles.reduce((s: number, f: any) => s + (f.tamano_bytes || 0), 0)
    const delBytes = delFiles.reduce((s: number, f: any) => s + (f.tamano_bytes || 0), 0)

    const res = await closeLote(selectedLote)

    if (res && res.ok) {
      const closedPath = selectedLote as string
      setLoteStats({ id: loteData.lote_id, conservados: res.conservados, eliminados: res.eliminados, bytesConservados: keepBytes, bytesEliminados: delBytes })
      setClosedLotes(prev => prev.includes(closedPath) ? prev : [...prev, closedPath])
      // mark lote as ready in metadata list
      setLoteList(prev => prev.map((it: any) => it.path === closedPath ? ({ ...it, ready: true, pendingCount: 0 }) : it))
      setLoteData(null)
      setSelectedLote(null)
      setStatusMsg(null)
      // in simple mode, automatically open next unclosed lote
      if (simpleMode) {
        try {
          const entries: any[] = (loteList && loteList.length > 0) ? loteList : (scanResult?.created?.map((p:string, idx:number)=>({ path: p })) || [])
          const next = entries.find((e:any) => e.path !== closedPath && !closedLotes.includes(e.path))
          if (next) await openLote(next.path)
        } catch (_) {}
      }
        // update persisted session (closed lot) — compute new closed list deterministically
        try {
          if (rootPath) {
            const newClosed = closedLotes.includes(closedPath) ? closedLotes : [...closedLotes, closedPath]
            const sess = { usuarioConfig: pendingUsuarioConfig, created: scanResult?.created || [], counts: scanResult?.counts || modalCounts || {}, closedLotes: newClosed }
            await saveSession(rootPath, sess).catch(() => {})
          }
        } catch (_) {}
    } else {
      const errMsg = res?.error || 'Error desconocido al cerrar lote'
      setStatusMsg('Error: ' + errMsg)
      setLastError(errMsg)
    }
  }

  async function handleRetry() {
    if (!selectedLote) return
    setLastError(null)
    setStatusMsg('Reintentando cierre...')
    const res = await closeLote(selectedLote)
    if (res && res.ok) {
      setLoteStats({ id: loteData?.lote_id || '?', conservados: res.conservados, eliminados: res.eliminados })
      setLoteData(null)
      setSelectedLote(null)
      setStatusMsg(null)
    } else {
      const errMsg = res?.error || 'Error desconocido en reintento'
      setStatusMsg('Error: ' + errMsg)
      setLastError(errMsg)
    }
  }

  async function handleFinalize() {
    setStatusMsg('Finalizando proceso global...')
    try {
      const mpRoot = rootPath ? `${rootPath}/.media-purgue` : ''
      const res = await finalizeLibrary(mpRoot)
      if (res && res.ok) {
        setGlobalStats(res.summary)
        setShowGlobalSummary(true)
        setStatusMsg(null)
      } else {
        setStatusMsg('Error al finalizar: ' + (res?.error || 'Desconocido'))
      }
    } catch (err: any) {
      setStatusMsg('Error fatal al finalizar: ' + err.message)
    }
  }

  const persistProgressEvent = React.useCallback((progressEvent: any, attempt = 0) => {
    if (!rootPath || !progressEvent) return
    const entry = {
      type: progressEvent?.type || 'progress:event',
      data: progressEvent
    }
    appendAppLog(rootPath, entry)
      .then(() => {
        readAppLog(rootPath)
          .then((res: any) => { if (res?.ok) setAppEvents(res.entries || []) })
          .catch(() => {})
      })
      .catch(() => {
        if (attempt < 2) {
          setTimeout(() => persistProgressEvent(progressEvent, attempt + 1), 200 * (attempt + 1))
        }
      })
  }, [rootPath])

  const addMessage = useProgressStore(s => s.addMessage)
  React.useEffect(() => {
    const unsub = onProgress((data: any) => {
      addMessage(data)
      // If a finalize result comes from main (auto-finalize), open global summary modal
      try {
        if (data && data.type === 'scan:lotePlan') {
          const total = Number(data.totalLotes || 0)
          scanProgressStartRef.current = Date.now()
          setCreateLotesProgress({ total, created: 0, percent: 0, etaSeconds: null })
        }
        if (data && data.type === 'scan:loteCreated') {
          setCreateLotesProgress((prev) => {
            const total = Number(data.totalLotes || prev.total || 0)
            const created = Number(data.createdCount || (prev.created + 1))
            const safeCreated = total > 0 ? Math.min(created, total) : created
            const percent = total > 0 ? Math.round((safeCreated / total) * 100) : Math.min(99, safeCreated * 5)
            let etaSeconds: number | null = null
            const start = scanProgressStartRef.current
            if (start && total > 0 && safeCreated >= 2) {
              const elapsedSec = (Date.now() - start) / 1000
              const avgPerLote = elapsedSec / safeCreated
              etaSeconds = Math.max(0, Math.round((total - safeCreated) * avgPerLote))
            }
            return { total, created: safeCreated, percent, etaSeconds }
          })
        }
        if (data && data.type === 'scan:done') {
          setCreateLotesProgress((prev) => {
            const total = Number(data.totalLotes || prev.total || 0)
            const created = Number(data.createdCount || total || prev.created)
            const safeCreated = total > 0 ? Math.min(created, total) : created
            return { total, created: safeCreated, percent: 100, etaSeconds: 0 }
          })
        }
        if (data && (data.type === 'finalize:autoStarted' || data.type === 'finalize:starting')) {
          setStatusMsg('Finalizando...')
        }
        if (data && (data.type === 'finalize:autoFinished' || data.type === 'finalize:finished' || data.type === 'finalize:copied' || data.type === 'finalize:moved')) {
          const payload = data.data || data.result || data
          // payload may contain { destino, summary } or summary directly
          const summary = payload?.summary || payload
          // map backend summary keys to modal's expected keys
          const mapped = {
            total_archivos_revisados: (summary?.archivos_procesados ?? summary?.procesos ?? 0) || 0,
            total_conservados: (summary?.conservados ?? 0) || 0,
            total_eliminados: (summary?.eliminados ?? 0) || 0,
            bytes_ahorrados: (summary?.espacio_total_liberado_bytes ?? summary?.espacio_total_conservado_bytes ?? 0) || 0
          }
          try { setGlobalStats(mapped) } catch (_) {}
          try { setFinalDestino(payload?.destino || payload?.destinoPath || payload?.path || null) } catch (_) {}
          try { setShowGlobalSummary(true) } catch (_) {}
          // auto-open final folder only once per finalize cycle
          try {
            const reqPath = payload?.destino || payload?.destinoPath || payload?.path || null
            if (reqPath && !autoOpenFinalOnceRef.current) {
              autoOpenFinalOnceRef.current = true
              // small delay to ensure OS has flushed operations
              setTimeout(() => { try { revealPath(reqPath) } catch (_) {} }, 300)
            }
          } catch (_) {}
          setStatusMsg(null)
        }
        if (data && data.type === 'finalize:autoFailed') {
          setStatusMsg('Error durante finalización: ' + (data.data?.error || ''))
        }
      } catch (_) {}
      // keep real-time UI (live store) and persist to app_events.json in parallel
      try { persistProgressEvent(data) } catch (_) {}
    })
    return unsub
  }, [addMessage, persistProgressEvent])

  // Load metadata (tipo, id) for each generated lote so we can show "Lote 1, Lote 2" and its tipo
  React.useEffect(() => {
    let cancelled = false
    async function computeMetaForPath(p: string) {
      try {
        const lote = await readLote(p)
        const archivos = Array.isArray(lote?.archivos) ? lote.archivos : []
        const totalBytes = archivos.reduce((s:any,f:any) => s + (f.tamano_bytes || 0), 0)
        let oldestTs: number | null = null
        archivos.forEach((f:any) => {
          try {
            const t = f.fecha_modificacion ? new Date(f.fecha_modificacion).getTime() : null
            if (t && (oldestTs === null || t < oldestTs)) oldestTs = t
          } catch (_) { }
        })
        const pendingCount = archivos.filter((f:any) => f.estado === 'pendiente').length
        const ready = closedLotes.includes(p)
        return { path: p, tipo: lote?.tipo, lote_id: lote?.lote_id, totalBytes, oldestTs, pendingCount, ready }
      } catch (err) {
        return { path: p }
      }
    }

    async function loadMeta() {
      if (!scanResult || !Array.isArray(scanResult.created)) return setLoteList([])
      const paths: string[] = scanResult.created
      const metas = await Promise.all(paths.map((p) => computeMetaForPath(p)))
      if (!cancelled) setLoteList(metas)
    }
    loadMeta()
    return () => { cancelled = true }
  }, [scanResult, closedLotes])

  // when in simple mode, prepare preview for the next unclosed lote
  React.useEffect(() => {
    let cancelled = false
    async function loadPreview() {
      if (!simpleMode) return setSimplePreview(null)
      if (loteData) return
      // build entries list similar to grid
      let entries: any[] = []
      if (loteList.length > 0) entries = loteList.map((it, idx) => ({ ...it, _idx: idx }))
      else if (scanResult && Array.isArray(scanResult.created)) entries = scanResult.created.map((p: string, idx: number) => ({ path: p, _idx: idx }))
      // find first not closed
      const next = entries.find(e => !closedLotes.includes(e.path))
      if (!next) return setSimplePreview(null)
      try {
        // open the next lote directly when entering simple mode
        if (!cancelled) {
          await openLote(next.path)
        }
      } catch (_) {
        if (!cancelled) setSimplePreview({ path: next.path })
      }
    }
    loadPreview()
    return () => { cancelled = true }
  }, [simpleMode, loteList, scanResult, closedLotes, loteData])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center flex-wrap sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img src="./logo.png" alt="Media Purgue" className="w-8 h-8 rounded-xl shadow object-cover" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Media Purgue</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Organizacion de multimedia</p>
          </div>
        </div>

        {/* controls removed from left header; they display on the right when scanResult exists */}

        {/* middle: file metadata (between app name and lote controls) */}
        <div className="flex-1 px-4 text-center min-w-0">
          {loteData && loteData.archivos && loteData.archivos[currentIndex] && (
            <div className="flex flex-col items-center">
              <div className="font-medium text-gray-800 truncate max-w-[50vw]" title={loteData.archivos[currentIndex].nombre}>{loteData.archivos[currentIndex].nombre}</div>
              <div className="text-xs text-gray-500">{formatBytes(loteData.archivos[currentIndex].tamano_bytes)} · {loteData.archivos[currentIndex].fecha_modificacion ? new Date(loteData.archivos[currentIndex].fecha_modificacion).toLocaleString() : ''}</div>
            </div>
          )}
          {!loteData && (
            // show centered title only after scanning
            scanResult ? <div className="text-lg font-semibold">Lotes Generados</div> : null
          )}
        </div>

        {/* right: lote info above buttons and global controls/counts (shown after scan) */}
        <div className="flex items-center">
          {loteData ? (
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span>Lote {loteData.lote_id}</span>
                    <span className="text-xs text-gray-500">{loteData.tipo === 'videos' ? 'Video' : 'Imagen'}</span>
                  </div>
                    {(() => {
                      const totalLotes = (loteList && loteList.length > 0) ? loteList.length : (scanResult?.created?.length ?? 0)
                      return (
                        <div>
                          <div className="text-xs text-gray-500 mt-1">Total lotes: {totalLotes}</div>
                          {simpleMode && (
                            (() => {
                              const totalLotes = (loteList && loteList.length > 0) ? loteList.length : (scanResult?.created?.length ?? 0)
                              const readyCount = (loteList && loteList.length > 0) ? loteList.filter((l:any) => l.ready).length : closedLotes.length
                              const pct = totalLotes ? Math.round((readyCount / totalLotes) * 100) : 0
                              return (
                                <div className="text-xs text-gray-600 mt-1">Completado: {pct}%</div>
                              )
                            })()
                          )}
                        </div>
                      )
                    })()}
                  {/* simple-mode header progress moved below Swiper */}
                </div>
              </div>
              <div>
                {!simpleMode && (
                  <button onClick={handleBackFromLote} className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium rounded-lg transition-colors border border-blue-200">
                    Atrás
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {scanResult && !loteData && (
            <div className="ml-4 hidden sm:flex items-center gap-3">
              <div className="text-sm px-3 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                Imágenes: {scanResult.counts?.images ?? 0} | Videos: {scanResult.counts?.videos ?? 0} | Lotes: {(scanResult.created?.length ?? loteList.length ?? 0)}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto grid grid-cols-12 gap-8">
        <section className="transition-all duration-300 col-span-12 max-w-4xl mx-auto w-full flex flex-col gap-6">

          {!scanResult && !loteData && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 text-gray-800">1. Seleccionar Origen</h2>
              <div className="flex gap-3 mb-8">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">📁</span>
                  </div>
                  <input readOnly value={rootPath} placeholder="Selecciona la carpeta a limpiar..." className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 shadow-inner focus:outline-none" />
                </div>
                <button onClick={handleSelectFolder} className="px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl transition-colors border border-indigo-200">
                  Seleccionar
                </button>
              </div>

              {rootPath && pendingUsuarioConfig && (
                <div className="animate-fadeIn">
                  <div className="flex items-center justify-center mb-2">
                      <button onClick={() => setShowConfigPanel(s => !s)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                        {showConfigPanel ? 'Ocultar configuración' : 'Mostrar configuración'}
                      </button>
                    </div>

                  {/* (totals moved below into the start area for nicer layout) */}

                  {/* configuration panel appears above the message so it pushes message/Iniciar down */}
                  {showConfigPanel && (
                    <div className="relative mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><span>⚙️</span> Configuración actual</h3>
                        <div>
                          <button onClick={handleOpenConfigModal} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                            Modificar
                          </button>
                        </div>
                      </div>
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-sm text-gray-700 grid grid-cols-2 gap-y-3 shadow-inner">
                        <div className="flex flex-col"><span className="text-gray-500 font-medium">Tamaño de lote</span> <span className="font-semibold">{pendingUsuarioConfig.tamano_lote_imagenes} imágenes | {pendingUsuarioConfig.tamano_lote_videos} videos</span></div>
                        <div className="flex flex-col"><span className="text-gray-500 font-medium">Criterio creacion lotes</span> <span className="font-semibold">{pendingUsuarioConfig.criterio === 'fecha_creacion' ? 'Fecha de creación' : 'Tamaño'}</span></div>
                        <div className="flex flex-col"><span className="text-gray-500 font-medium">Nombre carpeta final</span> <span className="font-semibold truncate">{pendingUsuarioConfig.nombre_biblioteca}</span></div>
                        <div className="flex flex-col"><span className="text-gray-500 font-medium">Ubicación</span> <span className="font-semibold truncate" title={pendingUsuarioConfig.ubicacion_biblioteca}>{pendingUsuarioConfig.ubicacion_biblioteca === rootPath ? '(misma carpeta de origen)' : pendingUsuarioConfig.ubicacion_biblioteca}</span></div>
                        <div className="flex flex-col"><span className="text-gray-500 font-medium">Tiempos estimados</span> <span className="font-semibold">{(pendingUsuarioConfig.secondsPerImage ?? 2.5)}s (imagen) · {(pendingUsuarioConfig.secondsPerVideo ?? 20)}s (video)</span></div>
                        <div className="flex flex-col"><span className="text-gray-500 font-medium">Incluir subcarpetas</span> <span className="font-semibold">{pendingUsuarioConfig.incluir_subcarpetas ? 'Sí' : 'No'}</span></div>
                      </div>
                    </div>
                  )}

                  {/* compact inline summary + message above Iniciar */}
                  <div className="py-6 text-center">
                    {(modalCounts || pendingUsuarioConfig) && (
                      (() => {
                        const imgCount = modalCounts?.images ?? 0
                        const vidCount = modalCounts?.videos ?? 0
                        const imgLotSize = pendingUsuarioConfig?.tamano_lote_imagenes || 1
                        const vidLotSize = pendingUsuarioConfig?.tamano_lote_videos || 1
                        const approxImgLotes = imgLotSize ? Math.ceil(imgCount / imgLotSize) : 0
                        const approxVidLotes = vidLotSize ? Math.ceil(vidCount / vidLotSize) : 0
                        const totalApprox = Math.max(1, approxImgLotes + approxVidLotes)
                        const secPerImg = pendingUsuarioConfig?.secondsPerImage ?? 5
                        const secPerVid = pendingUsuarioConfig?.secondsPerVideo ?? 30
                        const timePerImgLot = imgLotSize * secPerImg
                        const timePerVidLot = vidLotSize * secPerVid
                        const totalLotes = (loteList && loteList.length > 0) ? loteList.length : (scanResult?.created?.length ?? 0)
                        const readyCount = (loteList && loteList.length > 0) ? loteList.filter((l:any) => l.ready).length : 0
                        const pct = totalLotes ? Math.round((readyCount / totalLotes) * 100) : 0
                        return (
                          <>
                            <div className="mb-3 text-sm text-gray-700 text-center">
                              <span className="font-medium">Imágenes:</span> {imgCount} <span className="mx-2">|</span>
                              <span className="font-medium">Videos:</span> {vidCount} <span className="mx-2">|</span>
                              <span className="font-medium">Lotes:</span> {totalApprox}
                              <span className="mx-2">|</span>
                              <span className="font-medium">Tiempo estimado por lote:</span>
                              <span className="ml-1">{formatSeconds(timePerImgLot)} (imágenes) · {formatSeconds(timePerVidLot)} (videos)</span>
                              {/* stagingInfo percent removed per UX request */}
                            </div>
                            <div className="text-sm text-gray-600">Completado: {pct}%</div>
                            <div className="mb-2">
                              <div className="font-semibold text-gray-800">Al finalizar, se abrirá la carpeta con los archivos conservados.</div>
                            </div>
                          </>
                        )
                      })()
                    )}

                    <div className="flex flex-col items-center">
                      <label className="flex items-center gap-3 mb-3">
                        <input type="checkbox" checked={simpleMode} onChange={(e) => setSimpleMode(e.target.checked)} className="h-4 w-4 text-indigo-600 rounded" />
                        <span className="text-sm font-medium">Modo simple</span>
                      </label>

                      <div className="flex justify-center">
                        <button onClick={handleStartProcess} className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-colors">
                          {(scanResult && Array.isArray(scanResult.created) && scanResult.created.length > 0) ? 'Continuar' : 'Iniciar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {statusMsg && (
                <div className="mt-4 p-4 bg-blue-50 text-blue-800 text-sm font-medium rounded-xl flex items-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  {statusMsg}
                </div>
              )}
            </div>
          )}

          {scanResult && !loteData && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                  <div className="mb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {!simpleMode && (
                      <button onClick={() => setShowFinalizados(s => !s)} className={`px-3 py-1 rounded-lg font-medium transition-colors ${showFinalizados ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {showFinalizados ? 'Ocultar finalizados' : 'Mostrar finalizados'}
                      </button>
                    )}
                  </div>

                  <div className="flex-1 px-6">
                    {(() => {
                      const totalLotes = (loteList && loteList.length > 0) ? loteList.length : (scanResult.created?.length ?? 0)
                      const readyCount = (loteList && loteList.length > 0) ? loteList.filter((l:any) => l.ready).length : 0
                      const pct = totalLotes ? Math.round((readyCount / totalLotes) * 100) : 0
                      return (
                        <div className="w-full flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div className="bg-green-500 h-3 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-sm text-gray-600 w-15 text-right">{pct}% completado</div>
                        </div>
                      )
                    })()}
                  </div>

                  {!simpleMode && (
                    <div className="flex items-center gap-3">
                      <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="px-2 py-1 rounded border text-sm">
                        <option value="none">Sin ordenar</option>
                        <option value="size-asc">Tamaño ↑</option>
                        <option value="size-desc">Tamaño ↓</option>
                        <option value="date-asc">Fecha ↑</option>
                        <option value="date-desc">Fecha ↓</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {simpleMode ? (
                <div className="flex justify-center">
                  <div className="w-full max-w-xl bg-white border border-gray-200 rounded-xl p-6 text-left shadow-sm">
                      {simplePreview ? (
                        <>
                          <div className="flex items-center gap-4">
                            <div className="text-3xl">📦</div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800 truncate">Lote pendiente</div>
                              <div className="text-xs text-gray-500">{simplePreview.tipo === 'videos' ? 'Video' : 'Imagen'} {simplePreview.totalBytes ? `· ${formatBytes(simplePreview.totalBytes)}` : ''}</div>
                            </div>
                            <div>
                              <button onClick={() => simplePreview.path && openLote(simplePreview.path)} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold border border-indigo-100">Revisar</button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-gray-500">No hay lotes disponibles</div>
                      )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {(() => {
                    // build entries list (prefer metadata-loaded `loteList`)
                    let entries: any[] = []
                    if (loteList.length > 0) entries = loteList.map((it, idx) => ({ ...it, _idx: idx }))
                    else entries = scanResult.created.map((p: string, idx: number) => ({ path: p, _idx: idx }))

                    // filter finalizados when requested
                    if (!showFinalizados) entries = entries.filter(e => !closedLotes.includes(e.path))

                    // sorting
                    if (sortOption === 'size-asc') entries.sort((a, b) => (a.totalBytes || 0) - (b.totalBytes || 0))
                    else if (sortOption === 'size-desc') entries.sort((a, b) => (b.totalBytes || 0) - (a.totalBytes || 0))
                    else if (sortOption === 'date-asc') entries.sort((a, b) => (a.oldestTs || 0) - (b.oldestTs || 0))
                    else if (sortOption === 'date-desc') entries.sort((a, b) => (b.oldestTs || 0) - (a.oldestTs || 0))

                    return entries.map((item: any, idx: number) => {
                      const label = item.tipo === 'videos' ? 'Video' : 'Imagen'
                      const isClosed = closedLotes.includes(item.path)
                      return (
                        <div key={item.path} className={`border border-gray-200 rounded-xl p-4 flex flex-col gap-3 transition-shadow ${isClosed ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'hover:shadow-md bg-white'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">📦</span>
                            <div>
                              <div className={`font-semibold ${isClosed ? 'text-gray-600' : 'text-gray-700'}`}>Lote {item._idx + 1}</div>
                              <div className="text-xs text-gray-500">{label}{item.totalBytes ? ` · ${formatBytes(item.totalBytes)}` : ''}</div>
                            </div>
                          </div>
                          <button onClick={() => { if (!isClosed) openLote(item.path) }} className={`w-full py-2 ${isClosed ? 'bg-gray-400 text-gray-700 border-gray-300' : 'bg-gray-50 hover:bg-indigo-50 text-indigo-600 border border-gray-200 hover:border-indigo-200'} font-semibold rounded-lg transition-colors`} disabled={isClosed}>
                            {isClosed ? 'Lote finalizado' : 'Revisar Lote'}
                          </button>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          )}

          {loteData && (
            <div className="flex flex-col gap-4">
              {lastError && <ErrorBanner message={lastError} onRetry={handleRetry} />}

              {loteData.archivos.length > 0 && (
                <div className="animate-fadeIn">
                  <Swiper
                    file={loteData.archivos[currentIndex]}
                    prevFile={loteData.archivos[currentIndex - 1] ?? null}
                    nextFile={loteData.archivos[currentIndex + 1] ?? null}
                    onKeep={async () => {
                      const fileItem = loteData.archivos[currentIndex]
                      try { if (rootPath) appendAppLog(rootPath, { type: 'file:keep', data: { loteId: loteData.lote_id, orden: fileItem.orden, fileName: fileItem.nombre } }).catch(() => {}) } catch (_) {}
                      try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
                      await toggleEstado(fileItem.orden, 'conservar')
                      setCurrentIndex(i => Math.min(i + 1, loteData.archivos.length - 1))
                    }}
                    onDelete={async () => {
                      const fileItem = loteData.archivos[currentIndex]
                      try { if (rootPath) appendAppLog(rootPath, { type: 'file:delete', data: { loteId: loteData.lote_id, orden: fileItem.orden, fileName: fileItem.nombre } }).catch(() => {}) } catch (_) {}
                      try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
                      await toggleEstado(fileItem.orden, 'eliminar')
                      setCurrentIndex(i => Math.min(i + 1, loteData.archivos.length - 1))
                    }}
                    onPrev={() => setCurrentIndex(i => Math.max(0, i - 1))}
                    onNext={() => setCurrentIndex(i => Math.min(loteData.archivos.length - 1, currentIndex + 1))}
                    onRestart={() => setCurrentIndex(0)}
                    onFinalize={() => setShowFinalizeConfirm(true)}
                    showFinalize={((loteData.archivos || []).filter((f:any)=>f.estado==='pendiente').length === 0)}
                  />
                </div>
              )}
              {/* per-lote progress bar (shows current navigation progress within the lote). */}
              {loteData && (
                <div className="mt-4">
                  {(() => {
                    const archivos = Array.isArray(loteData.archivos) ? loteData.archivos : []
                    const totalFiles = archivos.length || 0
                    const currentPos = totalFiles ? Math.min(currentIndex + 1, totalFiles) : 0
                    const reviewedCount = archivos.filter((f:any) => f.estado !== 'pendiente').length
                    // Use the greatest value between navigation position and reviewed files
                    // to avoid off-by-one behavior on the final item.
                    const progressCount = totalFiles ? Math.min(totalFiles, Math.max(currentPos, reviewedCount)) : 0
                    const pctFile = totalFiles ? Math.round((progressCount / totalFiles) * 100) : 0
                    return (
                      <div className="w-full flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div className="bg-indigo-500 h-3 rounded-full" style={{ width: `${pctFile}%` }} />
                        </div>
                        <div className="w-24 text-sm text-gray-600 text-right">{totalFiles ? `${progressCount}/${totalFiles}` : ''}</div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </section>

        {showLogs && (
          <div className="fixed z-50 right-6" style={{ bottom: '92px' }}>
            <div className="flex flex-col items-end">
              <div className="bg-gray-900 rounded-xl p-3 text-xs text-green-400 font-mono shadow-inner shadow-black/20 h-[60vh] w-80 overflow-auto">
                {/* overlay without close button — clicking the toggle button controls visibility */}
                {(() => {
                  const live = useProgressStore.getState().messages || []
                  const persisted = (appEvents || []).map((e: any) => {
                    if (e?.data && !e?.payload) {
                      return {
                        ...e,
                        payload: e.data,
                        action: e.action || e.type || e.data?.type
                      }
                    }
                    return e
                  })
                  const liveNormalized = live.map((m: any, i: number) => ({
                    timestamp: m?.ts || new Date().toISOString(),
                    action: m?.type || 'progress:event',
                    payload: m,
                    __live: true,
                    __idx: i
                  }))

                  const displayed: any[] = [...persisted, ...liveNormalized]
                  if (!displayed || displayed.length === 0) {
                    return <div className="text-gray-600 italic">Esperando eventos...</div>
                  }
                  const deduped = displayed.filter((e: any, idx: number, arr: any[]) => {
                    const id = e?.id || `${e?.action || e?.type}|${e?.timestamp || e?.ts}|${e?.payload?.loteId || ''}|${e?.payload?.fileName || ''}`
                    return arr.findIndex((x: any) => {
                      const xid = x?.id || `${x?.action || x?.type}|${x?.timestamp || x?.ts}|${x?.payload?.loteId || ''}|${x?.payload?.fileName || ''}`
                      return xid === id
                    }) === idx
                  })
                  const displayedOrdered = deduped.slice().sort((a: any, b: any) => {
                    const ta = new Date(a.timestamp || a.ts || 0).getTime() || 0
                    const tb = new Date(b.timestamp || b.ts || 0).getTime() || 0
                    return tb - ta
                  })
                  return displayedOrdered.map((m: any, i: number) => {
                    const rawTs = m.ts || m.timestamp || ''
                    let ts = '??:??:??'
                    if (rawTs) {
                      const parsed = new Date(rawTs)
                      if (!isNaN(parsed.getTime())) {
                        try {
                          ts = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(parsed)
                        } catch (_) {
                          ts = parsed.toLocaleTimeString()
                        }
                      } else {
                        ts = (rawTs || '').split('T')[1]?.split('.')[0] || ((rawTs||rawTs)?.split ? (String(rawTs).split('T')[1]?.split('.')[0]) : '') || '??:??:??'
                      }
                    }
                    const action = m.action || m.type || m.payload?.type || m.payload?.action || 'event'
                    const loteInfo = m.payload?.loteId ? `· lote ${m.payload.loteId}` : (m.payload?.lotePath ? `· ${m.payload.lotePath.split('/').pop()}` : '')
                    return <div key={i} className="py-1 break-words opacity-90"><span className="text-gray-500">[{ts}]</span> <span className="font-medium">{action}</span> <span className="text-gray-300">{loteInfo}</span></div>
                  })
                })()}
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => {
            setShowLogs(s => {
              const newV = !s
              try {
                if (rootPath) appendAppLog(rootPath, { type: 'button:toggleLogs', data: { visible: newV } }).catch(() => {})
                try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
              } catch (_) {}
              return newV
            })
          }}
          className={`shadow-lg px-4 py-2 rounded-full font-semibold text-sm transition-colors border ${showLogs ? 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
        >
          {showLogs ? 'Ocultar logs técnicos' : '🛠️ Ver detalles técnicos'}
        </button>
      </div>

      <ConfigModal
        visible={modalVisible}
        counts={modalCounts || { images: 0, videos: 0 }}
        defaultConfig={pendingUsuarioConfig}
        onCancel={() => setModalVisible(false)}
        onSelectFolder={selectFolder}
        onConfirm={async (usuarioConfig: any) => {
          setModalVisible(false)
          setPendingUsuarioConfig(usuarioConfig)
          try { if (rootPath) appendAppLog(rootPath, { type: 'config:changed', data: usuarioConfig }).catch(() => {}) } catch (_) {}
          try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
          try { if (rootPath) saveUsuarioConfig(rootPath, usuarioConfig).catch(() => {}) } catch (_) {}
        }}
      />

      {showCreateLotesModal && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Creando lotes...</h3>
            <p className="text-sm text-gray-500 mb-4">Estamos organizando los archivos antes de continuar.</p>

            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-3">
              <div className="bg-indigo-600 h-4 rounded-full transition-all duration-200" style={{ width: `${createLotesProgress.percent}%` }} />
            </div>

            <div className="text-sm text-gray-700 font-semibold">
              {createLotesProgress.percent}%
              {createLotesProgress.total > 0 ? ` · ${createLotesProgress.created}/${createLotesProgress.total} lotes` : ''}
            </div>

            {createLotesProgress.etaSeconds !== null && createLotesProgress.percent < 100 && (
              <div className="text-xs text-gray-500 mt-2">
                Tiempo estimado restante: {formatSeconds(createLotesProgress.etaSeconds)}
              </div>
            )}
          </div>
        </div>
      )}

      <LoteSummaryModal
        visible={!!loteStats}
        loteId={loteStats?.id || '?'}
        stats={loteStats}
        onContinue={() => setLoteStats(null)}
      />

      <GlobalSummaryModal
        visible={showGlobalSummary}
        stats={globalStats}
        onOpenLibrary={() => {
          const reqPath = finalDestino || (rootPath ? rootPath.replace(/[/\\][^/\\]*$/, '') + '/Biblioteca_Final' : '')
          if (reqPath) revealPath(reqPath)
        }}
        onClose={() => {
          // fully reset UI to initial state so user can open a different folder
          setShowGlobalSummary(false)
          setScanResult(null)
          setLoteList([])
          setLoteData(null)
          setSelectedLote(null)
          setClosedLotes([])
          setLoteStats(null)
          setShowFinalizeConfirm(false)
          setModalVisible(false)
          setShowLogs(false)
          setStatusMsg(null)
          setRootPath('')
          setPendingUsuarioConfig(null)
          setModalCounts(null)
          setStagingInfo(null)
          setAppEvents([])
          setFinalDestino(null)
          setIncludeSub(true)
          setSimpleMode(true)
          setSimplePreview(null)
          autoOpenFinalOnceRef.current = false
        }}
      />

      {/* Finalize confirmation modal (two-step: counts -> sizes) */}
      {showFinalizeConfirm && loteData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-2">Confirmar cierre de lote</h3>
            <p className="text-sm text-gray-500 mb-6">¿Estás seguro de finalizar el lote?</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50 rounded-xl p-4">
                <span className="block text-2xl font-bold text-red-700">{(loteData.archivos || []).filter((f:any)=>f.estado==='eliminar').length}</span>
                <span className="text-xs uppercase tracking-wider font-semibold text-red-600">Eliminar</span>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <span className="block text-2xl font-bold text-green-700">{(loteData.archivos || []).filter((f:any)=>f.estado==='conservar').length}</span>
                <span className="text-xs uppercase tracking-wider font-semibold text-green-600">Conservar</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowFinalizeConfirm(false)} className="px-4 py-2 rounded-lg border">Cancelar</button>
              <button onClick={async () => {
                try { if (rootPath && loteData) appendAppLog(rootPath, { type: 'button:confirmClose', data: { loteId: loteData.lote_id } }).catch(() => {}) } catch (_) {}
                try { if (rootPath) readAppLog(rootPath).then((res:any)=>{ if(res?.ok) setAppEvents(res.entries||[]) }).catch(()=>{}) } catch(_) {}
                await handleCloseLote();
                setShowFinalizeConfirm(false)
              }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Confirmar cierre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
