import React from 'react'

type Props = {
  message: string | null
  staging?: string | null
  logPath?: string | null
  onRetry?: () => void
}

import React, { useState } from 'react'
import { revealPath, readLog } from '../ipc'

export default function ErrorBanner({ message, staging, logPath, onRetry }: Props) {
  const [logContent, setLogContent] = useState<any | null>(null)
  if (!message) return null
  return (
    <div style={{ background: '#fee', border: '1px solid #f88', padding: 10, margin: '8px 0' }}>
      <div style={{ marginBottom: 6 }}><strong>Error:</strong> {message}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {onRetry && <button onClick={onRetry}>Reintentar</button>}
        {staging && <button onClick={() => revealPath(staging)}>Abrir .staging</button>}
        {logPath && <button onClick={async () => { const c = await readLog(logPath); setLogContent(c) }}>Ver log</button>}
        {logPath && <button onClick={() => revealPath(logPath)}>Abrir carpeta del log</button>}
      </div>
      {logContent && (
        <div style={{ maxHeight: 240, overflow: 'auto', background: '#fff', padding: 8, border: '1px solid #ddd' }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(logContent, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
