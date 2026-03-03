# Media Purgue — Documentación del proyecto

Este documento reúne la especificación, diseño y flujo de trabajo de la aplicación "Media Purgue".

<!-- Contenido movido desde README.md -->

Proyecto scaffold para la aplicación "Media Purge" (Electron + React + TypeScript).

Estructura creada:

- `apps/electron-main` - código del proceso Main (Node/Electron)
- `apps/renderer` - aplicación React + TypeScript
- `packages/shared-types` - tipos compartidos (interfaces JSON)
- `scripts` - utilidades y documentación de scripts

Siguientes pasos:

1. Instalar dependencias: `npm install` (en la raíz)
2. Ajustar los scripts de `dev` y configurar `vite`/`tsconfig` según tu entorno
3. Implementar capas I/O en `apps/electron-main/src`

## Enunciado

### Objetivo

Eliminar una gran cantidad de fotos y videos de forma eficiente, cómoda y segura usando un sistema de lotes cerrados.

### Contexto

El sistema usa lotes representados por JSON y una carpeta oculta `.media-purgue` dentro de la carpeta de origen. Al finalizar, la Biblioteca Final se mueve a la ubicación configurada.

### Optimizaciones clave

- Lotes como archivos JSON (sin duplicar binarios).
- Operaciones transaccionales con carpeta `.staging` para evitar pérdida de datos.
- Logs por lote y resumen global (`global.json`).

## Estructura general (dentro de la carpeta de origen)

```
Carpeta_de_origen/
 ├── (archivos y subcarpetas originales)
 └── .media-purgue/                          # Carpeta oculta temporal
      ├── 01_Procesando/                       # Lotes (solo archivos JSON)
      ├── 02_Biblioteca_Final/                 # Temporal, se llena durante el proceso
      ├── Config/                               # Configuración del usuario
      └── Logs/                                 # Logs por lote
```

## Parámetros de usuario

Valores por defecto principales:

| Parámetro | Valor por defecto |
| --- | --- |
| Tamaño lote (imágenes) | 100 |
| Tamaño lote (videos) | 30 |
| Criterio | fecha creación |
| Nombre biblioteca final | Biblioteca_Final |
| Incluir subcarpetas | Sí |

Estos valores se guardan en `.media-purgue/Config/usuario.json`.

## Flujo resumido

1. Selección de carpeta de origen.
2. Escaneo y generación progresiva de lotes (JSON).
3. Revisión manual lote por lote (swipe/teclas) que actualiza el JSON.
4. Cierre transaccional del lote: copia a `.staging`, rename a Biblioteca Final, eliminación de originales, log.
5. Generación de `global.json` y limpieza final de `.media-purgue`.

## Stack tecnológico

- Electron (Main + Renderer)
- React + TypeScript
- Zustand para estado
- Tailwind CSS

---

El resto del README original (diagramas, mockups y detalles de implementación) permanece aquí para referencia y para desarrolladores que necesiten el diseño completo.
