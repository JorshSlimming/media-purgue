import React from 'react'

type GlobalStats = any

type Props = {
    visible: boolean
    stats: GlobalStats | null
    onOpenLibrary: () => void
    onClose: () => void
    t?: (key: string, vars?: Record<string,string>) => string
}

export default function GlobalSummaryModal({ visible, stats, onOpenLibrary, onClose, t }: Props) {
    if (!visible || !stats) return null

    const totalRevisados = Number(stats.total_archivos_revisados ?? stats.archivos_procesados ?? stats.procesos ?? stats.total ?? 0) || 0
    const totalConservados = Number(stats.total_conservados ?? stats.conservados ?? stats.total_conservados_en_biblioteca ?? 0) || 0
    const totalEliminados = Number(stats.total_eliminados ?? stats.eliminados ?? 0) || 0
    const bytesAhorrados = Number(stats.bytes_ahorrados ?? stats.espacio_total_liberado_bytes ?? stats.espacio_total_conservado_bytes ?? stats.bytes_ahorrados_total ?? 0) || 0
    const mbAhorrados = (bytesAhorrados / (1024 * 1024)).toFixed(2)

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full p-6 text-center overflow-hidden relative max-w-md sm:max-w-lg lg:max-w-2xl">

                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 to-purple-600 z-0"></div>

                <div className="relative z-10">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-4 border-indigo-50">
                        <span className="text-5xl">🎉</span>
                    </div>

                    <h2 className="text-3xl font-extrabold text-gray-800 mb-2">{(t||((k:string)=>k))('processCompleted')}</h2>
                    <p className="text-gray-500 mb-8">{(t||((k:string)=>k))('allDoneMessage')}</p>

                    <div className="space-y-3 mb-6 text-left">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">{(t||((k:string)=>k))('archivosRevisados')}</span>
                            <span className="font-bold text-gray-800">{totalRevisados}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-green-600 font-medium">{(t||((k:string)=>k))('conservadosBiblioteca')}</span>
                            <span className="font-bold text-green-700">{totalConservados}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-red-500 font-medium">{(t||((k:string)=>k))('archivosEliminados')}</span>
                            <span className="font-bold text-red-600">{totalEliminados}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 bg-indigo-50 px-4 rounded-lg mt-2">
                            <span className="text-indigo-800 font-bold">{(t||((k:string)=>k))('espacioLiberado')}</span>
                            <span className="font-extrabold text-indigo-900 text-xl">{mbAhorrados} MB</span>
                        </div>
                    </div>

                    <div className="flex gap-3 flex-col sm:flex-row">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                        >
                            {(t||((k:string)=>k))('cerrar')}
                        </button>
                        <button
                            onClick={onOpenLibrary}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md transition-colors"
                        >
                            {(t||((k:string)=>k))('abrirCarpetaFinal')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
