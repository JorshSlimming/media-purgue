import React, { useState } from 'react'

type Props = {
  visible: boolean
  counts: { images: number; videos: number }
  defaultConfig?: any
  onCancel: () => void
  onConfirm: (config: any) => void
}

export default function ConfigModal({ visible, counts, defaultConfig, onCancel, onConfirm }: Props) {
  const [imgSize, setImgSize] = useState(defaultConfig?.tamano_lote_imagenes ?? 100)
  const [vidSize, setVidSize] = useState(defaultConfig?.tamano_lote_videos ?? 30)

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: 20, width: 480, borderRadius: 8 }}>
        <h3>Confirmar generación de lotes</h3>
        <div>Imágenes encontradas: {counts.images}</div>
        <div>Videos encontrados: {counts.videos}</div>
        <div style={{ marginTop: 12 }}>
          <label>Tamaño lote (imágenes): <input type="number" value={imgSize} onChange={e => setImgSize(Number(e.target.value))} /></label>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Tamaño lote (videos): <input type="number" value={vidSize} onChange={e => setVidSize(Number(e.target.value))} /></label>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ marginRight: 8 }}>Cancelar</button>
          <button onClick={() => onConfirm({ tamano_lote_imagenes: imgSize, tamano_lote_videos: vidSize, criterio: 'fecha_creacion', nombre_biblioteca: 'Biblioteca_Final', ubicacion_biblioteca: '../' })}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}
