import React, { useState } from 'react'

type Props = {
  visible: boolean
  counts: { images: number; videos: number }
  defaultConfig?: any
  onCancel: () => void
  onConfirm: (config: any) => void
  onSelectFolder: () => Promise<string | null>
}

export default function ConfigModal({ visible, counts, defaultConfig, onCancel, onConfirm, onSelectFolder }: Props) {
  const [imgSize, setImgSize] = useState(defaultConfig?.tamano_lote_imagenes ?? 100)
  const [vidSize, setVidSize] = useState(defaultConfig?.tamano_lote_videos ?? 30)
  const [criterio, setCriterio] = useState(defaultConfig?.criterio ?? 'fecha_creacion')
  const [libName, setLibName] = useState(defaultConfig?.nombre_biblioteca ?? 'Biblioteca_Final')
  const [libLocation, setLibLocation] = useState(defaultConfig?.ubicacion_biblioteca ?? '../')

  if (!visible) return null

  async function handlePickFolder() {
    const p = await onSelectFolder()
    if (p) setLibLocation(p)
  }

  function handleSave() {
    onConfirm({
      tamano_lote_imagenes: imgSize,
      tamano_lote_videos: vidSize,
      criterio,
      nombre_biblioteca: libName,
      ubicacion_biblioteca: libLocation
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">⚙️ Configuración avanzada</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
            <p><strong>Imágenes encontradas:</strong> {counts.images}</p>
            <p><strong>Videos encontrados:</strong> {counts.videos}</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">📦 Tamaño de lote</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Imágenes</label>
                <input type="number" min="1" value={imgSize} onChange={e => setImgSize(Number(e.target.value))} className="w-full border rounded px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Videos</label>
                <input type="number" min="1" value={vidSize} onChange={e => setVidSize(Number(e.target.value))} className="w-full border rounded px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">🔽 Criterio de orden</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="criterio" value="fecha_creacion" checked={criterio === 'fecha_creacion'} onChange={e => setCriterio(e.target.value)} className="text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm">Fecha de creación</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="criterio" value="tamano" checked={criterio === 'tamano'} onChange={e => setCriterio(e.target.value)} className="text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm">Tamaño</span>
              </label>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">📛 Nombre de biblioteca final</h3>
            <input type="text" value={libName} onChange={e => setLibName(e.target.value)} className="w-full border rounded px-3 py-2 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">📍 Ubicación de la carpeta final</h3>
            <div className="flex gap-2">
              <input type="text" readOnly value={libLocation} className="flex-1 border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed" />
              <button onClick={handlePickFolder} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors">Examinar...</button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Por defecto '../' se ubica junto a la carpeta de origen.</p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t pt-4">
          <button onClick={onCancel} className="px-5 py-2 border rounded text-gray-600 hover:bg-gray-50 font-medium">Cancelar</button>
          <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm transition-colors">Guardar y Generar Lotes</button>
        </div>
      </div>
    </div>
  )
}
