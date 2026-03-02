import React from 'react'

type LoteStats = {
    conservados: number
    eliminados: number
    mbConservados?: number
    mbEliminados?: number
}

type Props = {
    visible: boolean
    loteId: string | number
    stats: LoteStats | null
    onContinue: () => void
}

export default function LoteSummaryModal({ visible, loteId, stats, onContinue }: Props) {
    if (!visible || !stats) return null

    const total = stats.conservados + stats.eliminados

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center transform transition-all scale-100">

                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Lote {loteId} cerrado!</h2>
                <p className="text-gray-500 text-sm mb-6">Has revisado {total} archivos con éxito.</p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-green-50 rounded-xl p-4">
                        <span className="block text-2xl font-bold text-green-700">{stats.conservados}</span>
                        <span className="text-xs uppercase tracking-wider font-semibold text-green-600">Conservados</span>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4">
                        <span className="block text-2xl font-bold text-red-700">{stats.eliminados}</span>
                        <span className="text-xs uppercase tracking-wider font-semibold text-red-600">Eliminados</span>
                    </div>
                </div>

                <button
                    onClick={onContinue}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    Continuar Revisando
                </button>
            </div>
        </div>
    )
}
