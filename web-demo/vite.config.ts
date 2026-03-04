import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Patch the renderer's App so "Finalizar lote" enables (and the auto-open
// modal triggers) as soon as the user navigates to the last file in the lote,
// instead of requiring every file to be explicitly marked first.
// Uses [^\n]+ regex so it is immune to TypeScript type-stripping differences.
const appLoteReadyPatch = {
  name: 'web-demo-app-loteready-patch',
  transform(code: string, id: string) {
    if (!/apps[/\\]renderer[/\\]src[/\\]App/.test(id)) return null
    let result = code
    // Force loteReady=true when user reaches the last file index
    result = result.replace(
      /const loteReady = loteData[^\n]+/,
      'const loteReady = loteData ? (Array.isArray(loteData.archivos) && loteData.archivos.length > 0 && currentIndex >= loteData.archivos.length - 1) : false',
    )
    // Force pendingCount=0 when on the last file so the auto-open modal also triggers
    result = result.replace(
      /const pendingCount = loteData[^\n]+/,
      "const pendingCount = loteData ? (currentIndex >= (loteData.archivos || []).length - 1 ? 0 : (loteData.archivos || []).filter((f) => f.estado === 'pendiente').length) : 0",
    )
    return result
  },
}

// Patch the renderer's Swiper so it uses ruta_original directly instead of
// the Electron-only "media://local/file?path=..." custom protocol.
const swiperMediaPatch = {
  name: 'web-demo-swiper-media-patch',
  transform(code: string, id: string) {
    if (!/apps[/\\]renderer[/\\]src[/\\]components[/\\]Swiper/.test(id)) return null
    return code
      // main mediaSrc
      .replace(
        /`media:\/\/local\/file\?path=\$\{encodeURIComponent\(file\.ruta_original\)\}`/g,
        'file.ruta_original',
      )
      // prev-file thumbnail
      .replace(
        /"media:\/\/local\/file\?path=" \+ encodeURIComponent\(prevFile\.ruta_original \|\| ''\)/g,
        "(prevFile.ruta_original || '')",
      )
      // next-file thumbnail
      .replace(
        /"media:\/\/local\/file\?path=" \+ encodeURIComponent\(nextFile\.ruta_original \|\| ''\)/g,
        "(nextFile.ruta_original || '')",
      )
  },
}

export default defineConfig({
  plugins: [react(), appLoteReadyPatch, swiperMediaPatch],
  base: '/media-purgue/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    // Allow Vite to serve files from the monorepo root so imports like
    // `../../apps/renderer/src/App` resolve during dev.
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
