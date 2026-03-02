import React, { useState } from 'react'
import { revealPath, readLog } from '../ipc'

type Props = {
  message: string | null
  staging?: string | null
  logPath?: string | null
  onRetry?: () => void
}

export default function ErrorBanner({ message, staging, logPath, onRetry }: Props) {
  const [logContent, setLogContent] = useState<any | null>(null)

  if (!message) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 my-4 shadow-sm relative">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-red-500 text-xl font-bold mt-0.5">⚠️</div>
        <div>
          <h3 className="text-red-800 font-bold mb-1">Se encontró un problema</h3>
          <p className="text-red-700 text-sm font-medium leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-2 ml-9">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-colors text-sm"
          >
            🔄 Reintentar
          </button>
        )}
        {staging && (
          <button
            onClick={() => revealPath(staging)}
            className="px-4 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-semibold rounded-lg shadow-sm transition-colors text-sm"
          >
            📂 Abrir .staging
          </button>
        )}
        {logPath && (
          <button
            onClick={async () => { const c = await readLog(logPath); setLogContent(c) }}
            className="px-4 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-semibold rounded-lg shadow-sm transition-colors text-sm"
          >
            📋 Ver log
          </button>
        )}
        {logPath && (
          <button
            onClick={() => revealPath(logPath)}
            className="px-4 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-semibold rounded-lg shadow-sm transition-colors text-sm"
          >
            📂 Carpeta del log
          </button>
        )}
      </div>

      {logContent && (
        <div className="mt-4 ml-9 bg-white border border-red-100 rounded-lg p-4 max-h-60 overflow-auto shadow-inner">
          <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono">
            {JSON.stringify(logContent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
