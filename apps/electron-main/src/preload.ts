import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('mp', {
  ping: () => ipcRenderer.invoke('ping'),
  scanFolder: (opts: any) => ipcRenderer.invoke('mp:scanFolder', opts),
  inspectFolder: (opts: any) => ipcRenderer.invoke('mp:inspectFolder', opts),
  readLote: (lotePath: string) => ipcRenderer.invoke('mp:readLote', lotePath),
  updateArchivoEstado: (args: any) => ipcRenderer.invoke('mp:updateArchivoEstado', args),
  closeLote: (lotePath: string) => ipcRenderer.invoke('mp:closeLote', lotePath),
  listStaging: (root: string) => ipcRenderer.invoke('mp:listStaging', root),
  selectFolder: () => ipcRenderer.invoke('mp:selectFolder'),
  revealPath: (p: string) => ipcRenderer.invoke('mp:revealPath', p),
  onProgress: (cb: (data: any) => void) => {
    const listener = (_: any, data: any) => cb(data)
    ipcRenderer.on('mp:progress', listener)
    return () => ipcRenderer.removeListener('mp:progress', listener)
  },
  appendAppLog: (root: string, entry: any) => ipcRenderer.invoke('mp:appendAppLog', root, entry),
  readAppLog: (root: string) => ipcRenderer.invoke('mp:readAppLog', root),
  saveSession: (root: string, session: any) => ipcRenderer.invoke('mp:saveSession', root, session),
  loadSession: (root: string) => ipcRenderer.invoke('mp:loadSession', root),
  finalizeLibrary: (root: string) => ipcRenderer.invoke('mp:finalizeLibrary', root),
  listLogs: (root: string) => ipcRenderer.invoke('mp:listLogs', root),
  readLog: (fullPathOrMpRoot: string, fileName?: string) => ipcRenderer.invoke('mp:readLog', fullPathOrMpRoot, fileName)
})
