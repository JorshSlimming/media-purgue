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
  }
})
