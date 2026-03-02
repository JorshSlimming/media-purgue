import React, { useEffect, useState } from 'react'

export default function LogViewer({ mpRoot }: { mpRoot: string }) {
  const [logs, setLogs] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const names = await (window as any).mp.listLogs(mpRoot)
      setLogs(names || [])
    }
    if (mpRoot) load()
  }, [mpRoot])

  useEffect(() => {
    async function read() {
      if (!selected) return
      const c = await (window as any).mp.readLog(mpRoot, selected)
      setContent(c)
    }
    read()
  }, [selected, mpRoot])

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 240, border: '1px solid #ddd', padding: 8 }}>
        <h4>Logs</h4>
        <ul>
          {logs.map(l => (
            <li key={l}><button onClick={() => setSelected(l)}>{l}</button></li>
          ))}
        </ul>
      </div>
      <div style={{ flex: 1, border: '1px solid #ddd', padding: 8, whiteSpace: 'pre-wrap' }}>
        <h4>Contenido</h4>
        <pre>{JSON.stringify(content, null, 2)}</pre>
      </div>
    </div>
  )
}
