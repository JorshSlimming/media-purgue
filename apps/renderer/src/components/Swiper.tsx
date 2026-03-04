import React, { useState, useRef, useEffect } from 'react'

type FileItem = { nombre: string; ruta_original: string; tipo?: string; estado?: 'pendiente' | 'conservar' | 'eliminar'; fecha_modificacion?: string; tamano_bytes?: number }

type Props = {
  file: FileItem
  prevFile?: FileItem | null
  nextFile?: FileItem | null
  onKeep: () => void
  onDelete: () => void
  onPrev?: () => void
  onNext?: () => void
  onRestart?: () => void
  onFinalize?: () => void
  showFinalize?: boolean
  t?: (key: string, vars?: Record<string,string>) => string
}

export default function Swiper({ file, prevFile, nextFile, onKeep, onDelete, onPrev, onNext, onRestart, onFinalize, showFinalize, t }: Props) {
  const isVideo = /\.(mp4|mov|webm|mkv|avi)$/i.test(file.nombre)
  const mediaSrc = `media://local/file?path=${encodeURIComponent(file.ruta_original)}`
  const [videoReady, setVideoReady] = useState(!isVideo)
  const [tx, setTx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // keep only Arrow keys for actions
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (isVideo && !videoReady) return
        onKeep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (isVideo && !videoReady) return
        onDelete()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeep, onDelete, isVideo, videoReady])

  // reset videoReady when the file changes so videos start disabled until metadata loads
  useEffect(() => {
    setVideoReady(!isVideo)
  }, [file.ruta_original, isVideo])

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    setDragging(true)
    try { (e.target as Element).setPointerCapture(e.pointerId) } catch (_) { }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || startX.current === null) return
    const delta = e.clientX - startX.current
    setTx(delta)
  }

  function handlePointerUp(e: React.PointerEvent) {
    setDragging(false)
    const threshold = 120
    if (tx > threshold) {
      if (!(isVideo && !videoReady)) onKeep()
    } else if (tx < -threshold) {
      if (!(isVideo && !videoReady)) onDelete()
    }
    setTx(0)
    startX.current = null
    try { (e.target as Element).releasePointerCapture(e.pointerId) } catch (_) { }
  }

  const isKept = file?.estado === 'conservar'
  const isDeleted = file?.estado === 'eliminar'

  function formatDate(iso?: string) {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleString()
    } catch (_) { return iso }
  }

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

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg w-full overflow-visible border border-gray-100 flex flex-col relative">
        {/* Header removed from Swiper; header info moved to App header */}

        {/* Media Container */}
        <div
          ref={containerRef}
          className="relative bg-black w-full flex items-center justify-center touch-pan-y overflow-hidden select-none"
          style={{ height: '78vh', minHeight: '420px' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Overlay indicators for drag */}
          <div className="absolute inset-0 z-10 pointer-events-none flex justify-between items-center px-8 transition-opacity duration-200" style={{ opacity: Math.abs(tx) > 20 ? 1 : 0 }}>
            <div className={`rounded-full bg-red-500 bg-opacity-80 p-6 text-white text-4xl shadow-lg transform transition-transform ${tx < 0 ? 'scale-110' : 'scale-50 opacity-0'}`}>
              🗑️
            </div>
            <div className={`rounded-full bg-green-500 bg-opacity-80 p-6 text-white text-4xl shadow-lg transform transition-transform ${tx > 0 ? 'scale-110' : 'scale-50 opacity-0'}`}>
              ✅
            </div>
          </div>

          {/* Video loading guard: prevent actions until metadata loaded */}
          {isVideo && !videoReady && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white rounded-md px-4 py-3 flex items-center gap-3">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                <span>{(t || ((k:string)=>k))('loadingVideo')}</span>
              </div>
            </div>
          )}

          {/* Small previews for prev / next (clickable) */}
          {prevFile && !/\.(mp4|mov|webm|mkv|avi)$/i.test(prevFile.nombre) && (
            <button onClick={() => { try { onPrev && onPrev() } catch {} }} title={prevFile.nombre} className={"hidden lg:flex absolute left-4 bottom-6 w-32 h-40 bg-black/60 rounded-md overflow-hidden flex-col items-center justify-start border border-white/10 z-20"}>
              <img src={"media://local/file?path=" + encodeURIComponent(prevFile.ruta_original || '')} alt={prevFile.nombre} className="w-full h-28 object-contain opacity-100" />
              <span className="text-xs text-white/90 mt-1">{(t || ((k:string)=>k))('prev')}</span>
            </button>
          )}
          {nextFile && !/\.(mp4|mov|webm|mkv|avi)$/i.test(nextFile.nombre) && (
            <button onClick={() => { try { onNext && onNext() } catch {} }} title={nextFile.nombre} className={"hidden lg:flex absolute right-4 bottom-6 w-32 h-40 bg-black/60 rounded-md overflow-hidden flex-col items-center justify-start border border-white/10 z-20"}>
              <img src={"media://local/file?path=" + encodeURIComponent(nextFile.ruta_original || '')} alt={nextFile.nombre} className="w-full h-28 object-contain opacity-100" />
              <span className="text-xs text-white/90 mt-1">{(t || ((k:string)=>k))('next')}</span>
            </button>
          )}

          {/* Draggable Media */}
          <div
            className="h-full w-full flex items-center justify-center"
            style={{
              transform: `translateX(${tx}px) rotate(${tx * 0.05}deg)`,
              transition: dragging ? 'none' : 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
            {isVideo ? (
              <video
                src={mediaSrc}
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="max-h-full max-w-full object-contain pointer-events-auto"
                onError={(e) => {
                  const video = e.target as HTMLVideoElement
                  setVideoReady(false)
                  console.error('Video error:', {
                    error: video.error,
                    code: video.error?.code,
                    message: video.error?.message,
                    networkState: video.networkState,
                    readyState: video.readyState,
                    src: video.src
                  })
                }}
                onLoadedMetadata={() => { setVideoReady(true); console.log('Video metadata loaded') }}
              />
            ) : (
              <img
                src={mediaSrc}
                alt={file.nombre}
                className="max-h-full max-w-full object-contain pointer-events-none"
              />
            )}
          </div>
        </div>
        {/* Prev / Next attached to media section (outside but visible), centered vertically */}
        <button onClick={() => { try { onPrev && onPrev() } catch {} }} aria-hidden={false} className={`hidden lg:block absolute left-[-56px] top-1/2 -translate-y-1/2 p-2 rounded-full bg-white border shadow-md z-30 ring-1 ring-blue-100 ${!prevFile ? ' opacity-40 pointer-events-none' : ''}`}>
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <button onClick={() => { try { onNext && onNext() } catch {} }} aria-hidden={false} className={`hidden lg:block absolute right-[-56px] top-1/2 -translate-y-1/2 p-2 rounded-full bg-white border shadow-md z-30 ring-1 ring-blue-100 ${!nextFile ? ' opacity-40 pointer-events-none' : ''}`}>
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>

        {/* Action buttons aligned with Prev/Next (same vertical center) */}
          {(() => {
          const actionsDisabled = isVideo && !videoReady
          return (
            <button
              onClick={() => { if (!actionsDisabled) onDelete() }}
              aria-pressed={isDeleted}
              aria-disabled={actionsDisabled}
              className={`hidden lg:block absolute left-[-240px] top-[72%] translate-y-0 px-10 py-4 text-white text-lg font-bold rounded-full z-50 transition-transform ${isDeleted ? 'bg-red-800 scale-[0.97] shadow-inner translate-y-1 ring-4 ring-red-300/30' : 'bg-red-600 hover:bg-red-700 shadow-2xl'} ${actionsDisabled ? 'opacity-60 pointer-events-none' : ''}`}
              style={{ boxShadow: isDeleted ? 'inset 0 4px 8px rgba(0,0,0,0.25)' : '0 16px 40px rgba(220,38,38,0.25)' }}
            >
              {(t || ((k:string)=>k))('deleteLabel')}
            </button>
          )
        })()}

          {(() => {
          const actionsDisabled = isVideo && !videoReady
          return (
            <button
              onClick={() => { if (!actionsDisabled) onKeep() }}
              aria-pressed={isKept}
              aria-disabled={actionsDisabled}
              className={`hidden lg:block absolute right-[-240px] top-[72%] translate-y-0 px-10 py-4 text-white text-lg font-bold rounded-full z-50 transition-transform ${isKept ? 'bg-green-800 scale-[0.97] shadow-inner translate-y-1 ring-4 ring-green-300/30' : 'bg-green-600 hover:bg-green-700 shadow-2xl'} ${actionsDisabled ? 'opacity-60 pointer-events-none' : ''}`}
              style={{ boxShadow: isKept ? 'inset 0 4px 8px rgba(0,0,0,0.22)' : '0 16px 40px rgba(34,197,94,0.22)' }}
            >
              {(t || ((k:string)=>k))('keepLabel')}
            </button>
          )
        })()}

        {/* Reiniciar button removed per UX — 'Volver a Revisar' no longer used */}

        {/* Finalizar Lote removed from Swiper - control moved to App header */}

        {/* Bottom action bar for narrower windows */}
        <div className="lg:hidden w-full flex items-center justify-center gap-4 py-3 bg-white">
          <button onClick={() => { if (!(isVideo && !videoReady)) onDelete() }} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold">{(t || ((k:string)=>k))('deleteLabel')}</button>
          <button onClick={() => { if (!(isVideo && !videoReady)) onKeep() }} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-semibold">{(t || ((k:string)=>k))('keepLabel')}</button>
        </div>
      </div>

      {/* suggestion removed per UX request */}
    </div>
  )
}
