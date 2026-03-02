import React, { useState } from 'react'
import { scanFolder, readLote, updateArchivoEstado, closeLote, inspectFolder, selectFolder, listStaging, revealPath, onProgress, finalizeLibrary } from './ipc'
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

  // Modals stats state
  const [loteStats, setLoteStats] = useState<{ id: string | number, conservados: number, eliminados: number } | null>(null)
  const [globalStats, setGlobalStats] = useState<any | null>(null)
  const [showGlobalSummary, setShowGlobalSummary] = useState(false)

  async function handleSelectFolder() {
    const p = await selectFolder()
    if (p) {
      setRootPath(p)
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
            incluir_subcarpetas: true
          })
        }
        const st = await listStaging(p)
        setStagingInfo(st)
      } catch (err: any) {
        setStatusMsg('Error inspeccionando: ' + (err.message || String(err)))
      }
    }
  }

  async function handleStartProcess() {
    setStatusMsg('Generando lotes en segundo plano...')
    try {
      setScanResult({ created: [], counts: modalCounts })
      const res = await scanFolder({ rootPath, includeSubfolders: pendingUsuarioConfig?.incluir_subcarpetas ?? true, usuarioConfig: pendingUsuarioConfig })
      setScanResult(res)
      setStatusMsg(null)
    } catch (err: any) {
      setStatusMsg('Error generando lotes: ' + (err.message || String(err)))
    }
  }

  async function openLote(path: string) {
    setSelectedLote(path)
    const lote = await readLote(path)
    setLoteData(lote)
    setCurrentIndex(0)
  }

  async function toggleEstado(orden: number, nuevo: 'conservar' | 'eliminar') {
    if (!selectedLote) return
    await updateArchivoEstado({ lotePath: selectedLote, orden, nuevoEstado: nuevo })
    const lote = await readLote(selectedLote)
    setLoteData(lote)
  }

  async function handleCloseLote() {
    if (!selectedLote || !loteData) return
    setStatusMsg(`Cerrando lote ${loteData.lote_id}...`)
    setLastError(null)
    const res = await closeLote(selectedLote)

    if (res && res.ok) {
      setLoteStats({ id: loteData.lote_id, conservados: res.conservados, eliminados: res.eliminados })
      setLoteData(null)
      setSelectedLote(null)
      setStatusMsg(null)
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

  const addMessage = useProgressStore(s => s.addMessage)
  React.useEffect(() => {
    const unsub = onProgress((data: any) => {
      addMessage(data)
      if (data.type === 'scan:loteCreated') {
        setScanResult((prev: any) => {
          if (!prev) return { created: [data.lotePath], counts: null }
          if (prev.created.includes(data.lotePath)) return prev
          return { ...prev, created: [...prev.created, data.lotePath] }
        })
      } else if (data.type === 'scan:counts') {
        setScanResult((prev: any) => {
          if (!prev) return { created: [], counts: data.counts }
          return { ...prev, counts: data.counts }
        })
      }
    })
    return () => unsub()
  }, [addMessage])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow flex items-center justify-center font-bold text-xl">M</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Media Purgue</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Organización de Archivos</p>
          </div>
        </div>

        {scanResult && scanResult.created.length > 0 && !loteData && (
          <button
            onClick={handleFinalize}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors flex items-center gap-2"
          >
            <span>✨ Finalizar Proceso</span>
          </button>
        )}
      </header>

      <main className="p-6 max-w-7xl mx-auto grid grid-cols-12 gap-8">
        <section className={`transition-all duration-300 ${showLogs ? 'col-span-8' : 'col-span-12 max-w-4xl mx-auto w-full'} flex flex-col gap-6`}>

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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span>⚙️</span> Configuración actual
                    </h3>
                    <button onClick={() => setModalVisible(true)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                      Modificar
                    </button>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-sm text-gray-700 grid grid-cols-2 gap-y-3 mb-8 shadow-inner">
                    <div className="flex flex-col"><span className="text-gray-500 font-medium">Tamaño de lote</span> <span className="font-semibold">{pendingUsuarioConfig.tamano_lote_imagenes} imágenes | {pendingUsuarioConfig.tamano_lote_videos} videos</span></div>
                    <div className="flex flex-col"><span className="text-gray-500 font-medium">Criterio</span> <span className="font-semibold">{pendingUsuarioConfig.criterio === 'fecha_creacion' ? 'Fecha de creación' : 'Tamaño'}</span></div>
                    <div className="flex flex-col"><span className="text-gray-500 font-medium">Nombre biblioteca</span> <span className="font-semibold truncate">{pendingUsuarioConfig.nombre_biblioteca}</span></div>
                    <div className="flex flex-col"><span className="text-gray-500 font-medium">Ubicación</span> <span className="font-semibold truncate" title={pendingUsuarioConfig.ubicacion_biblioteca}>{pendingUsuarioConfig.ubicacion_biblioteca === rootPath ? '(misma carpeta de origen)' : pendingUsuarioConfig.ubicacion_biblioteca}</span></div>
                    <div className="flex flex-col"><span className="text-gray-500 font-medium">Incluir subcarpetas</span> <span className="font-semibold">{pendingUsuarioConfig.incluir_subcarpetas ? 'Sí' : 'No'}</span></div>
                    <div className="flex flex-col"><span className="text-gray-500 font-medium">Archivos estimados</span> <span className="font-semibold text-indigo-600">{modalCounts?.images} img / {modalCounts?.videos} vid</span></div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500 flex-1 pr-6">
                      📍 La biblioteca final se creará en la ubicación configurada. Archivos originales serán eliminados si los rechazas.
                    </p>
                    <button onClick={handleStartProcess} className="px-8 py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-colors hover:scale-105 active:scale-95 flex items-center gap-2 flex-shrink-0">
                      ▶ Iniciar proceso
                    </button>
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
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">2. Lotes Generados</h2>
                <div className="text-sm px-3 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                  Imágenes: {scanResult.counts?.images ?? 0} | Videos: {scanResult.counts?.videos ?? 0}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {scanResult.created.map((p: string, idx: number) => {
                  const fileName = p.split(/[/\\]/).pop() || p
                  return (
                    <div key={p} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow bg-white">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📦</span>
                        <span className="font-semibold text-gray-700 truncate" title={fileName}>{fileName}</span>
                      </div>
                      <button onClick={() => openLote(p)} className="w-full py-2 bg-gray-50 hover:bg-indigo-50 text-indigo-600 font-semibold rounded-lg border border-gray-200 hover:border-indigo-200 transition-colors">
                        Revisar Lote
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loteData && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-indigo-600">Lote {loteData.lote_id}</span>
                  <span className="text-gray-400 font-normal text-sm px-2 py-0.5 border rounded-full">{loteData.tipo}</span>
                </h2>

                <div className="flex gap-3">
                  <button onClick={() => setLoteData(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 font-medium rounded-lg transition-colors border border-gray-200">
                    Atrás / Pausar
                  </button>
                  <button onClick={handleCloseLote} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow transition-colors">
                    Finalizar Lote
                  </button>
                </div>
              </div>

              {lastError && <ErrorBanner message={lastError} onRetry={handleRetry} />}

              {loteData.archivos.length > 0 && (
                <div className="animate-fadeIn">
                  <Swiper
                    file={loteData.archivos[currentIndex]}
                    onKeep={async () => { await toggleEstado(loteData.archivos[currentIndex].orden, 'conservar'); setCurrentIndex(i => Math.min(i + 1, loteData.archivos.length - 1)) }}
                    onDelete={async () => { await toggleEstado(loteData.archivos[currentIndex].orden, 'eliminar'); setCurrentIndex(i => Math.min(i + 1, loteData.archivos.length - 1)) }}
                  />

                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0} className={`p-2 rounded-full border-2 ${currentIndex === 0 ? 'text-gray-300 border-gray-200' : 'text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'} transition-colors bg-white`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <span className="text-gray-500 font-semibold min-w-[80px] text-center bg-white px-4 py-1.5 rounded-full border shadow-sm">
                      {currentIndex + 1} / {loteData.archivos.length}
                    </span>
                    <button onClick={() => setCurrentIndex(i => Math.min(i + 1, loteData.archivos.length - 1))} disabled={currentIndex === loteData.archivos.length - 1} className={`p-2 rounded-full border-2 ${currentIndex === loteData.archivos.length - 1 ? 'text-gray-300 border-gray-200' : 'text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'} transition-colors bg-white`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {showLogs && (
          <aside className="col-span-4 space-y-6 animate-fadeIn">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[350px]">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-gray-400">⚡</span> Progreso en vivo
              </h4>
              <div className="flex-1 overflow-auto bg-gray-900 rounded-xl p-3 text-xs text-green-400 font-mono shadow-inner shadow-black/20">
                {useProgressStore.getState().messages.map((m, i) => (
                  <div key={i} className="py-1 break-words opacity-90"><span className="text-gray-500">[{m.ts.split('T')[1].split('.')[0]}]</span> {JSON.stringify(m.payload)}</div>
                ))}
                {useProgressStore.getState().messages.length === 0 && (
                  <div className="text-gray-600 italic">Esperando eventos...</div>
                )}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-gray-400">📝</span> Auditoría
              </h4>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 h-32 overflow-auto">
                <LogViewer mpRoot={rootPath ? `${rootPath}/.media-purgue` : ''} />
              </div>
            </div>

            {stagingInfo && stagingInfo.files.length > 0 && (
              <div className="bg-orange-50 p-5 rounded-2xl shadow-sm border border-orange-200">
                <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                  <span>⚠️</span> Recuperación (.staging)
                </h4>
                <p className="text-xs text-orange-600 mb-3">Hay archivos pendientes de un cierre interrumpido.</p>
                <button onClick={() => revealPath(stagingInfo.staging)} className="w-full py-2 bg-white text-orange-700 font-semibold rounded-lg border border-orange-300 hover:bg-orange-100 transition-colors text-sm">
                  Abrir carpeta .staging
                </button>
              </div>
            )}
          </aside>
        )}
      </main>

      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => setShowLogs(s => !s)}
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
          // Just save it. "Iniciar proceso" handles the actual generation now!
        }}
      />

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
          let reqPath = rootPath
          // fallback location guessing (since we don't have user config globally stored in state)
          if (rootPath) reqPath = rootPath.replace(/[/\\][^/\\]*$/, '') + '/Biblioteca_Final'
          revealPath(reqPath)
        }}
        onClose={() => setShowGlobalSummary(false)}
      />
    </div>
  )
}
