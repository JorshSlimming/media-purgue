import React, { useState } from 'react'
import { scanFolder, readLote, updateArchivoEstado, closeLote, inspectFolder, selectFolder, listStaging, revealPath, onProgress } from './ipc'
import ConfigModal from './components/ConfigModal'
import LogViewer from './components/LogViewer'
import Swiper from './components/Swiper'
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

  async function handleScan() {
    setStatusMsg('Escaneando...')
    try {
      const res = await scanFolder({ rootPath, includeSubfolders: includeSub, usuarioConfig: undefined })
      setScanResult(res)
      setStatusMsg('Escaneo completado')
    } catch (err: any) {
      setStatusMsg('Error: ' + (err.message || String(err)))
    }
  }

  async function handleSelectFolder() {
    const p = await selectFolder()
    if (p) {
      setRootPath(p)
      setStatusMsg('Inspeccionando carpeta...')
      try {
        const info = await inspectFolder({ rootPath: p, includeSubfolders: includeSub })
        setStatusMsg(null)
        const counts = info.counts || { images: 0, videos: 0 }
        setModalCounts(counts)
        setModalVisible(true)
        // attempt to read staging info for enhanced error UI
        const st = await listStaging(p)
        setStagingInfo(st)
      } catch (err: any) {
        setStatusMsg('Error inspeccionando: ' + (err.message || String(err)))
      }
    }
  }

  async function openLote(path: string) {
    setSelectedLote(path)
    const lote = await readLote(path)
    setLoteData(lote)
    // prepare current index
    setCurrentIndex(0)
  }

  const [currentIndex, setCurrentIndex] = React.useState(0)

  async function toggleEstado(orden: number, nuevo: 'conservar' | 'eliminar') {
    if (!selectedLote) return
    await updateArchivoEstado({ lotePath: selectedLote, orden, nuevoEstado: nuevo })
    // refresh
    const lote = await readLote(selectedLote)
    setLoteData(lote)
  }

  async function handleCloseLote() {
    if (!selectedLote) return
    setStatusMsg('Cerrando lote...')
    const res = await closeLote(selectedLote)
    if (res && res.ok) {
      setStatusMsg('Lote cerrado: ' + JSON.stringify({ conservados: res.conservados, eliminados: res.eliminados }))
      setLoteData(null)
      setSelectedLote(null)
    } else {
      const errMsg = res?.error || 'Error desconocido al cerrar lote'
      setStatusMsg('Error: ' + errMsg)
      setLastError(errMsg)
    }
  }

  const [lastError, setLastError] = useState<string | null>(null)
  async function handleRetry() {
    if (!selectedLote) return
    setLastError(null)
    setStatusMsg('Reintentando cierre...')
    const res = await closeLote(selectedLote)
    if (res && res.ok) {
      setStatusMsg('Reintento exitoso')
      setLoteData(null)
      setSelectedLote(null)
    } else {
      const errMsg = res?.error || 'Error desconocido en reintento'
      setStatusMsg('Error: ' + errMsg)
      setLastError(errMsg)
    }
  }

  // subscribe to progress events
  const addMessage = useProgressStore(s => s.addMessage)
  React.useEffect(() => {
    const unsub = onProgress((data: any) => {
      addMessage(data)
    })
    return () => unsub()
  }, [addMessage])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <header className="flex items-center gap-4 mb-6">
        <img src="/logo.png" alt="Media Purgue" className="w-12 h-12 object-contain" />
        <div>
          <h1 className="text-2xl font-semibold">Media Purgue</h1>
          <p className="text-sm text-gray-600">Revisión por lotes — demo</p>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-6">
        <section className="col-span-7 bg-white p-6 rounded-lg shadow-sm">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Carpeta raíz</label>
            <div className="mt-2 flex items-center gap-2">
              <input value={rootPath} readOnly placeholder="Selecciona una carpeta..." className="flex-1 border rounded px-3 py-2 bg-gray-50" />
              <button onClick={handleSelectFolder} className="px-3 py-2 bg-indigo-600 text-white rounded">Seleccionar</button>
            </div>
            <label className="inline-flex items-center gap-2 mt-3 text-sm">
              <input type="checkbox" checked={includeSub} onChange={e => setIncludeSub(e.target.checked)} className="form-checkbox" />
              <span>Incluir subcarpetas</span>
            </label>
          </div>

          <div className="mb-4">
            <button onClick={handleScan} className="px-4 py-2 bg-green-600 text-white rounded">Iniciar escaneo</button>
          </div>

          {statusMsg && <div className="mb-4 text-sm text-gray-700 font-medium">{statusMsg}</div>}

          {scanResult && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold">Resultados</h3>
              <div className="mt-2 text-sm text-gray-700">Imágenes detectadas: {scanResult.counts?.images ?? 0}</div>
              <div className="text-sm text-gray-700">Videos detectados: {scanResult.counts?.videos ?? 0}</div>

              <h4 className="mt-4 font-medium">Lotes creados</h4>
              <ul className="mt-2 space-y-2">
                {scanResult.created.map((p: string) => (
                  <li key={p} className="flex items-center gap-2">
                    <button onClick={() => openLote(p)} className="px-2 py-1 bg-indigo-600 text-white rounded">Abrir</button>
                    <span className="text-sm text-gray-600 truncate">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loteData && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Lote {loteData.lote_id} — {loteData.tipo}</h3>
              <div className="mt-3">
                {loteData.archivos.length > 0 && (
                  <div>
                    <Swiper file={loteData.archivos[currentIndex]} onKeep={async () => { await toggleEstado(loteData.archivos[currentIndex].orden, 'conservar'); setCurrentIndex(i => Math.min(i+1, loteData.archivos.length-1)) }} onDelete={async () => { await toggleEstado(loteData.archivos[currentIndex].orden, 'eliminar'); setCurrentIndex(i => Math.min(i+1, loteData.archivos.length-1)) }} />
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => setCurrentIndex(i => Math.max(0, i-1))} disabled={currentIndex===0} className="px-3 py-1 border rounded">Anterior</button>
                      <span className="text-sm">{currentIndex+1}/{loteData.archivos.length}</span>
                      <button onClick={() => setCurrentIndex(i => Math.min(i+1, loteData.archivos.length-1))} disabled={currentIndex===loteData.archivos.length-1} className="px-3 py-1 border rounded">Siguiente</button>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <button onClick={handleCloseLote} className="px-3 py-2 bg-red-600 text-white rounded">Cerrar lote</button>
                  {lastError && <button className="ml-3 px-3 py-2 border rounded" onClick={handleRetry}>Reintentar</button>}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            {lastError && React.createElement((require('./components/ErrorBanner').default), { message: lastError, onRetry: handleRetry })}
          </div>
        </section>

        <aside className="col-span-5 space-y-6">
          <div className="bg-white p-4 rounded shadow-sm">
            <h4 className="font-semibold">Progreso</h4>
            <div className="mt-2 max-h-48 overflow-auto text-xs text-gray-700 bg-gray-50 p-2">
              {useProgressStore.getState().messages.map((m, i) => (
                <div key={i} className="py-1">[{m.ts}] {JSON.stringify(m.payload)}</div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow-sm">
            <h4 className="font-semibold">Logs</h4>
            <div className="mt-2">
              <LogViewer mpRoot={rootPath ? `${rootPath}/.media-purgue` : ''} />
            </div>
          </div>

          {stagingInfo && stagingInfo.staging && (
            <div className="bg-white p-4 rounded shadow-sm">
              <h4 className="font-semibold">.staging</h4>
              <div className="mt-2 text-sm text-gray-600">Path: {stagingInfo.staging}</div>
              <div className="mt-1 text-sm text-gray-600">Files: {stagingInfo.files.join(', ') || '—'}</div>
              <div className="mt-3">
                <button onClick={() => revealPath(stagingInfo.staging)} className="px-3 py-1 border rounded">Abrir .staging</button>
              </div>
            </div>
          )}
        </aside>
      </main>

      <ConfigModal visible={modalVisible} counts={modalCounts || { images: 0, videos: 0 }} defaultConfig={pendingUsuarioConfig} onCancel={() => setModalVisible(false)} onConfirm={async (usuarioConfig: any) => {
        setModalVisible(false)
        setStatusMsg('Generando lotes...')
        try {
          const res = await scanFolder({ rootPath, includeSubfolders: includeSub, usuarioConfig })
          setScanResult(res)
          setStatusMsg('Lotes generados')
        } catch (err: any) {
          setStatusMsg('Error generando lotes: ' + (err.message || String(err)))
        }
      }} />
    </div>
  )
}
