import React, { useState, useRef, useEffect } from 'react'

type Props = {
  file: { nombre: string; ruta_original: string; tipo?: string }
  onKeep: () => void
  onDelete: () => void
}

export default function Swiper({ file, onKeep, onDelete }: Props) {
  const isVideo = /\.(mp4|mov|webm|mkv|avi)$/i.test(file.nombre)
  const [tx, setTx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        onKeep()
      } else if (e.key === 'ArrowLeft' || e.key === 'Delete' || e.key === 'Backspace') {
        onDelete()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeep, onDelete])

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    setDragging(true)
    try { (e.target as Element).setPointerCapture(e.pointerId) } catch (_) {}
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
    try { (e.target as Element).releasePointerCapture(e.pointerId) } catch (_) {}
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, maxWidth: 800 }}>
      <div style={{ marginBottom: 8 }}>{file.nombre}</div>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ marginBottom: 8, touchAction: 'pan-y' }}>
        <div style={{ transform: `translateX(${tx}px)`, transition: dragging ? 'none' : 'transform 150ms ease-out', display: 'inline-block' }}>
          {isVideo ? (
            <video src={`file://${file.ruta_original}`} controls width={640} preload="metadata" style={{ maxHeight: 480 }} />
          ) : (
            <img src={`file://${file.ruta_original}`} alt={file.nombre} style={{ maxWidth: '100%', maxHeight: 480 }} />
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onDelete}>Eliminar</button>
        <button onClick={onKeep}>Conservar</button>
      </div>
    </div>
  )
}
