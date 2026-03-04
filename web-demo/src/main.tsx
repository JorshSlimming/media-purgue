// Install mock if running in browser
if (typeof window !== 'undefined' && !(window as any).mp) {
  // dynamic import to ensure Vite includes the module
  import('./web-mock-mp')
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../apps/renderer/src/App'
import './index.css'



// expose the project root logo to the renderer App (Vite will return a URL)
import logoUrl from '../../logo.png'
declare global { interface Window { __mpLogo?: string } }
if (typeof window !== 'undefined') window.__mpLogo = logoUrl

// Set favicon to the Vite-resolved logo URL so the browser tab shows the exact PNG
if (typeof document !== 'undefined') {
  try {
    const setFavicon = (url: string) => {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.type = 'image/png'
      link.href = url
    }
    setFavicon(logoUrl)
  } catch (e) {}
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
