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
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Media Purgue" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        <h1 style={{ margin: 0 }}>Media Purgue — Demo UI</h1>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Carpeta raíz: </label>
        <input value={rootPath} readOnly style={{ width: 400 }} placeholder="Selecciona una carpeta..." />
        <button onClick={handleSelectFolder} style={{ marginLeft: 8 }}>Seleccionar...</button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>
          <input type="checkbox" checked={includeSub} onChange={e => setIncludeSub(e.target.checked)} /> Incluir subcarpetas
        </label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <button onClick={handleScan}>Iniciar escaneo y generar lotes (demo)</button>
      </div>

      {statusMsg && <div><strong>{statusMsg}</strong></div>}

      {scanResult && (
        <div style={{ marginTop: 16 }}>
          <h3>Resultados</h3>
          <div>Imágenes detectadas: {scanResult.counts?.images ?? 0}</div>
          <div>Videos detectados: {scanResult.counts?.videos ?? 0}</div>
          <h4>Lotes creados</h4>
          <ul>
            {scanResult.created.map((p: string) => (
              <li key={p}>
                <button onClick={() => openLote(p)} style={{ marginRight: 8 }}>Abrir</button>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loteData && (
        <div style={{ marginTop: 16 }}>
          <h3>Lote {loteData.lote_id} — {loteData.tipo}</h3>
          <div>Archivos:</div>
          <div>
            {loteData.archivos.length > 0 && (
              <Swiper file={loteData.archivos[currentIndex]} onKeep={async () => { await toggleEstado(loteData.archivos[currentIndex].orden, 'conservar'); setCurrentIndex(i => Math.min(i+1, loteData.archivos.length-1)) }} onDelete={async () => { await toggleEstado(loteData.archivos[currentIndex].orden, 'eliminar'); setCurrentIndex(i => Math.min(i+1, loteData.archivos.length-1)) }} />
            )}
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setCurrentIndex(i => Math.max(0, i-1))} disabled={currentIndex===0}>Anterior</button>
              <span style={{ margin: '0 8px' }}>{currentIndex+1}/{loteData.archivos.length}</span>
              <button onClick={() => setCurrentIndex(i => Math.min(i+1, loteData.archivos.length-1))} disabled={currentIndex===loteData.archivos.length-1}>Siguiente</button>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={handleCloseLote}>Cerrar lote (demo)</button>
            {lastError && <button style={{ marginLeft: 8 }} onClick={handleRetry}>Reintentar</button>}
          </div>
        </div>
      )}
      {/* error banner */}
      <div style={{ marginTop: 12 }}>
        {/* lazy load component to avoid bundling if not used */}
        {lastError && React.createElement((require('./components/ErrorBanner').default), { message: lastError, onRetry: handleRetry })}
      </div>
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
      <div style={{ marginTop: 20 }}>
        <h3>Progreso</h3>
        <div style={{ maxHeight: 200, overflow: 'auto', background: '#f6f6f6', padding: 8 }}>
          {useProgressStore.getState().messages.map((m, i) => (
            <div key={i} style={{ fontSize: 12 }}>[{m.ts}] {JSON.stringify(m.payload)}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <h3>Logs</h3>
        <LogViewer mpRoot={rootPath ? `${rootPath}/.media-purgue` : ''} />
        {stagingInfo && stagingInfo.staging && (
          <div style={{ marginTop: 12 }}>
            <h4>.staging</h4>
            <div>Path: {stagingInfo.staging}</div>
            <div>Files: {stagingInfo.files.join(', ') || '—'}</div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => revealPath(stagingInfo.staging)}>Abrir .staging</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
