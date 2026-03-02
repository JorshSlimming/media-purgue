interface MPApi {
  ping(): Promise<string>
  scanFolder(opts: any): Promise<any>
  readLote(lotePath: string): Promise<any>
  updateArchivoEstado(args: any): Promise<any>
  closeLote(lotePath: string): Promise<any>
  listStaging(root: string): Promise<any>
  selectFolder(): Promise<string | null>
  inspectFolder(opts: { rootPath: string; includeSubfolders?: boolean }): Promise<any>
  onProgress(cb: (data: any) => void): () => void
}

interface Window {
  mp: MPApi
}

export {}
