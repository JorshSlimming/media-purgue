# Media Purgue

Electron + React app to review and clean large photo/video collections via batch JSON workflows with transactional safety.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-26.0.0-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.0.0-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## Demo

Try the interactive web demo: **[media-purgue.github.io](https://media-purgue.github.io)**

The web demo simulates the complete user interface and workflow without requiring Electron or accessing real files.

## Quick start

```bash
# Install dependencies
npm install

# Run in development mode (renderer + main + electron)
npm run dev

# Build and package for Windows
npm run dist:win
```

## Overview

Media Purgue helps you efficiently review and clean large media collections through:

- **Batch JSON workflows** - Process files in configurable batches without duplicating binaries
- **Transactional safety** - Uses `.staging` folder to prevent data loss during operations
- **Fast review UI** - Swipe or keyboard navigation for quick decisions
- **Detailed logging** - Per-batch and global logs for auditability

## Architecture

```
Carpeta_de_origen/
 ├── (your photos/videos)
 └── .media-purgue/
      ├── 01_Procesando/       # Batch JSON files only
      ├── 02_Biblioteca_Final/ # Staging → final library
      ├── Config/              # usuario.json
      └── Logs/                # Per-batch logs + global.json
```

### Stack

- **Main process**: Node.js + Electron
- **Renderer**: React 18 + TypeScript + Vite
- **State**: Zustand
- **Styling**: Tailwind CSS
- **Video transcoding**: ffmpeg-static + fluent-ffmpeg

## Features

| Feature | Description |
|---------|-------------|
| Batch scanning | Auto-scan folders and create JSON batches |
| Configurable batch size | Separate settings for images (default: 100) and videos (default: 30) |
| Transactional close | Copy → rename → delete with rollback via `.staging` |
| Multi-language | Spanish/English with auto-detection |
| Session persistence | Resume work after closing the app |
| Progress tracking | Real-time progress and ETA for batch creation |
| Auto-finalize | Automatically finalize library when all batches complete |

## JSON contracts

See `docs/json-contracts.md` for full specifications. Key formats:

**usuario.json** (configuration)
```json
{
  "tamano_lote_imagenes": 100,
  "tamano_lote_videos": 30,
  "criterio": "fecha_creacion",
  "nombre_biblioteca": "Biblioteca_Final",
  "ubicacion_biblioteca": "../",
  "incluir_subcarpetas": true
}
```

**lote_XXXX.json** (batch file)
```json
{
  "lote_id": 1,
  "tipo": "imagenes",
  "criterio": "fecha_creacion",
  "fecha_creacion": "2024-01-01T10:00:00Z",
  "archivos": [
    {
      "nombre": "vacaciones.jpg",
      "ruta_original": "C:/Users/Usuario/Fotos/vacaciones.jpg",
      "tamano_bytes": 4200000,
      "fecha_modificacion": "2023-08-15T14:30:00Z",
      "estado": "pendiente",
      "orden": 1
    }
  ]
}
```

**global.json** (final summary)
```json
{
  "procesos": 7,
  "archivos_procesados": 350,
  "conservados": 160,
  "eliminados": 190,
  "espacio_total_conservado_bytes": 1342177280,
  "espacio_total_liberado_bytes": 335544320,
  "generado_en": "2024-01-02T12:10:00Z"
}
```

## Project structure

```
media-purgue/
├── apps/
│   ├── electron-main/      # Main process (Node/Electron)
│   └── renderer/           # React + TypeScript UI
├── packages/
│   └── shared-types/       # TypeScript interfaces
├── tests/
│   ├── unit/               # Unit tests
│   ├── property/           # Property-based tests
│   └── e2e/                # Playwright E2E tests
├── docs/
│   ├── project-overview.md # Full project spec
│   ├── json-contracts.md   # JSON format specifications
│   └── samples/            # Example JSON files
├── web-demo/               # Web demo (React + Vite)
└── scripts/                # Build and utility scripts
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

This launches:
1. Vite dev server on `http://localhost:5173`
2. TypeScript compiler in watch mode for main process
3. Electron app

### Build

```bash
# Build renderer and main
npm run build

# Package for current platform
npm run dist

# Package for specific platform
npm run dist:win      # Windows (NSIS)
npm run dist:linux    # Linux (AppImage, deb)
```

### Testing

```bash
# Run unit and property tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Documentation

- `docs/project-overview.md` - Full project specification and workflow
- `docs/json-contracts.md` - JSON format specifications
- `docs/dev-windows.md` - Windows-specific development notes
- `docs/samples/` - Example JSON files

## Web Demo

The web demo is located in the `web-demo/` folder. It provides an interactive visual simulation of the application without requiring Electron.

### Running the demo locally

```bash
cd web-demo
npm install
npm run dev
```

The demo will be available at `http://localhost:5174/`

### Building for production

```bash
cd web-demo
npm run build
```

The built files will be in `web-demo/dist/`

### Deploying to GitHub Pages

```bash
cd web-demo
npm run build
git subtree push --prefix dist origin gh-pages
```

The demo will be available at `https://<username>.github.io/media-purgue/`

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Video transcoding powered by [FFmpeg](https://ffmpeg.org/)
