import React from 'react'

type LoteStats = {
    conservados: number
    eliminados: number
    bytesConservados?: number
    bytesEliminados?: number
}

type Props = {
    visible: boolean
    loteId: string | number
    stats: LoteStats | null
    onContinue: () => void
    t: (key: string, vars?: Record<string,string>) => string
}

export default function LoteSummaryModal({ visible, loteId, stats, onContinue, t }: Props) {
    if (!visible || !stats) return null

    const total = stats.conservados + stats.eliminados

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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center transform transition-all scale-100">

                <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('loteCerrado', { id: String(loteId) })}</h2>
                <p className="text-gray-500 text-sm mb-6">{t('reviewedFiles', { total: String(total) })}</p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-green-50 rounded-xl p-4">
                        <span className="block text-2xl font-bold text-green-700">{stats.conservados}</span>
                        <span className="text-xs uppercase tracking-wider font-semibold text-green-600">{t('conservar')}</span>
                        {typeof stats.bytesConservados !== 'undefined' && (
                            <div className="text-xs text-gray-600 mt-2">{formatBytes(stats.bytesConservados)}</div>
                        )}
                    </div>
                    <div className="bg-red-50 rounded-xl p-4">
                        <span className="block text-2xl font-bold text-red-700">{stats.eliminados}</span>
                        <span className="text-xs uppercase tracking-wider font-semibold text-red-600">{t('eliminar')}</span>
                        {typeof stats.bytesEliminados !== 'undefined' && (
                            <div className="text-xs text-gray-600 mt-2">{formatBytes(stats.bytesEliminados)}</div>
                        )}
                    </div>
                </div>

                <button
                    onClick={onContinue}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    {t('continuarRevisando')}
                </button>
            </div>
        </div>
    )
}
