import React from 'react'

type GlobalStats = {
    total_archivos_revisados: number
    total_conservados: number
    total_eliminados: number
    bytes_ahorrados: number
}

type Props = {
    visible: boolean
    stats: GlobalStats | null
    onOpenLibrary: () => void
    onClose: () => void
}

export default function GlobalSummaryModal({ visible, stats, onOpenLibrary, onClose }: Props) {
    if (!visible || !stats) return null

    const mbAhorrados = (stats.bytes_ahorrados / (1024 * 1024)).toFixed(2)

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center overflow-hidden relative">

                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 to-purple-600 z-0"></div>

                <div className="relative z-10">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-4 border-indigo-50">
                        <span className="text-5xl">🎉</span>
                    </div>

                    <h2 className="text-3xl font-extrabold text-gray-800 mb-2">¡Proceso Completado!</h2>
                    <p className="text-gray-500 mb-8">Todos los lotes han sido procesados y tu biblioteca está limpia.</p>

                    <div className="space-y-3 mb-8 text-left">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">Archivos revisados:</span>
                            <span className="font-bold text-gray-800">{stats.total_archivos_revisados}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-green-600 font-medium">Conservados en Biblioteca:</span>
                            <span className="font-bold text-green-700">{stats.total_conservados}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-red-500 font-medium">Archivos eliminados:</span>
                            <span className="font-bold text-red-600">{stats.total_eliminados}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 bg-indigo-50 px-4 rounded-lg mt-2">
                            <span className="text-indigo-800 font-bold">Espacio liberado:</span>
                            <span className="font-extrabold text-indigo-900 text-xl">{mbAhorrados} MB</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={onOpenLibrary}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md transition-colors"
                        >
                            Abrir carpeta final
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
