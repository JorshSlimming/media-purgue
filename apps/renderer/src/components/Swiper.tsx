import React, { useState, useRef, useEffect } from 'react'

type Props = {
  file: { nombre: string; ruta_original: string; tipo?: string; estado?: 'pendiente' | 'conservar' | 'eliminar' }
  onKeep: () => void
  onDelete: () => void
}

export default function Swiper({ file, onKeep, onDelete }: Props) {
  const isVideo = /\.(mp4|mov|webm|mkv|avi)$/i.test(file.nombre)
  const mediaSrc = `media://local/file?path=${encodeURIComponent(file.ruta_original)}`
  const [tx, setTx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onKeep()
      } else if (e.key === 'ArrowLeft' || e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onDelete()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeep, onDelete])

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
    if (tx > threshold) onKeep()
    else if (tx < -threshold) onDelete()
    setTx(0)
    startX.current = null
    try { (e.target as Element).releasePointerCapture(e.pointerId) } catch (_) { }
  }

  const isKept = file.estado === 'conservar'
  const isDeleted = file.estado === 'eliminar'

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg w-full overflow-hidden border border-gray-100 flex flex-col">
        {/* Header / Filename */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <span className="font-medium text-gray-700 truncate mr-2" title={file.nombre}>
            {file.nombre}
          </span>
          {file.estado && file.estado !== 'pendiente' && (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase tracking-wide flex-shrink-0 ${isKept ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isKept ? '✅ Conservado' : '🗑️ Eliminado'}
            </span>
          )}
        </div>

        {/* Media Container */}
        <div
          ref={containerRef}
          className="relative bg-black w-full flex items-center justify-center touch-pan-y overflow-hidden select-none"
          style={{ height: '60vh', minHeight: '400px' }}
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
                  console.error('Video error:', {
                    error: video.error,
                    code: video.error?.code,
                    message: video.error?.message,
                    networkState: video.networkState,
                    readyState: video.readyState,
                    src: video.src
                  })
                }}
                onLoadedMetadata={() => console.log('Video metadata loaded')}
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

        {/* Footer Controls */}
        <div className="p-4 bg-white flex justify-between items-center gap-4 border-t border-gray-100">
          <button
            onClick={onDelete}
            className="flex-1 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg transition-colors flex flex-col items-center justify-center group"
          >
            <span className="text-lg">Eliminar</span>
            <span className="text-xs text-red-400 group-hover:text-red-500 mt-1">← / Supr</span>
          </button>

          <button
            onClick={onKeep}
            className="flex-1 py-3 px-4 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-lg transition-colors flex flex-col items-center justify-center group"
          >
            <span className="text-lg">Conservar</span>
            <span className="text-xs text-green-400 group-hover:text-green-500 mt-1">→ / Enter</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4 font-medium tracking-wide w-full text-center">
        SUGERENCIA: Puedes arrastrar la imagen hacia los lados o usar el teclado.
      </p>
    </div>
  )
}
