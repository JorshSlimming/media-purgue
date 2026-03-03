# Media Purgue

<img src="logo.png" alt="Media Purgue" width="120" />

Aplicación para revisar y limpiar grandes colecciones de fotos y videos mediante lotes JSON, con un flujo transaccional seguro y una UI de revisión rápida (swipe o teclado).

Rápido (Quick start):

```bash
# instalar deps
npm install

# modo desarrollo (renderer + main + electron)
npm run dev

# build + empaquetado (Windows x64 NSIS)
npm run dist:win
```

Descargas y binarios: revisa la sección *Releases* del repositorio (se incluye el instalador `Media Purgue Setup <version>.exe`).



```mermaid
stateDiagram-v2
    [*] --> Creado: Se genera JSON del lote

    Creado --> EnRevision: Usuario abre el lote
    EnRevision --> EnRevision: Usuario revisa archivos<br/>(cambia estados en JSON)
    EnRevision --> Completado: Todos los archivos tienen<br/>estado "conservar" o "eliminar"

    Completado --> Cerrando: Usuario inicia cierre
    Cerrando --> EnStaging: Copiando/moviendo a .staging
    EnStaging --> Confirmando: Moviendo staging a biblioteca
    Confirmando --> Eliminando: Eliminando originales
    Eliminando --> Cerrado: Operaciones exitosas<br/>(se elimina lote y JSON)

    Cerrando --> ErrorEnStaging: Fallo al copiar a staging
    ErrorEnStaging --> Cerrando: Usuario reintenta<br/>(se limpia staging)
    Confirmando --> ErrorEnConfirmacion: Fallo al mover staging
    ErrorEnConfirmacion --> Cerrando: Usuario reintenta<br/>(staging intacto)

    Cerrado --> [*]

    note right of Creado: También se puede forzar cierre<br/>aunque queden pendientes
    note right of ErrorEnConfirmacion: Queda carpeta .staging
```

### **Secuencia para el cierre transaccional**

```mermaid
sequenceDiagram
    participant Usuario
    participant Interfaz as Interfaz React
    participant GestorLote as Gestor de Lote (Node.js)
    participant Staging as Carpeta .staging
    participant FS as Sistema de Archivos

    Usuario->>Interfaz: Hace clic en "Cerrar lote"
    Interfaz->>GestorLote: solicitarCierre(loteId)

    Note over GestorLote: Paso 1: Leer JSON y preparar listas

    loop Por cada archivo a conservar
        GestorLote->>FS: copiar/mover a .staging
        FS-->>GestorLote: resultado
        alt Si falla
            GestorLote->>FS: limpiar .staging
            GestorLote->>Interfaz: error
            Interfaz->>Usuario: "Error al copiar a staging"
        end
    end

    Note over GestorLote: Si todo fue bien en staging
    loop Mover de staging a biblioteca final
        GestorLote->>FS: rename (move) a destino final
        FS-->>GestorLote: resultado
        alt Si falla
            GestorLote->>Interfaz: error
            Interfaz->>Usuario: "Error al mover a biblioteca, reintentar"
        end
    end

    Note over GestorLote: Si todo fue bien en movimientos
    loop Por cada archivo a eliminar
        GestorLote->>FS: eliminar original
        FS-->>GestorLote: resultado
        alt Si falla
            GestorLote->>Interfaz: error (parcial)
            Interfaz->>Usuario: "Error al eliminar algunos archivos"
        end
    end

    GestorLote->>FS: generar log
    FS-->>GestorLote: log guardado
    GestorLote->>FS: eliminar JSON y carpeta del lote
    FS-->>GestorLote: eliminado
    GestorLote->>Interfaz: cierreCompletado(resumen)
    Interfaz->>Usuario: mostrar resumen del lote
```

### **Componentes (arquitectura)**

```mermaid
graph TB
    subgraph "Electron Main Process"
        Main[Main Process<br/>Node.js]
        FileSystem[File System Module<br/>fs, fs.promises]
        JSONManager[JSON Manager<br/>lectura/escritura]
        StagingManager[Staging Manager<br/>manejo de .staging]
        Logger[Logger<br/>logs y métricas]
    end

    subgraph "Electron Renderer Process"
        UI[UI React]
        Components[Componentes:<br/>Swiper, Preview, Config]
        State[Estado global<br/>Context/Zustand]
    end

    subgraph "Almacenamiento"
        Dir[Carpeta de origen]
        MediaPurge[".media-purgue"]
        ConfigFile[usuario.json]
        LotFolders[Carpetas de lotes<br/>con archivos JSON]
        LogFiles[Archivos .log]
        FinalLibrary[Biblioteca Final<br/>archivos conservados + global.json]
        StagingFolder[Carpeta .staging<br/>dentro de Biblioteca_Final]
    end

    UI --> Components
    Components --> State
    State -- IPC --> Main
    Main --> FileSystem
    Main --> JSONManager
    Main --> StagingManager
    Main --> Logger

    FileSystem --> Dir
    FileSystem --> MediaPurge
    JSONManager --> ConfigFile
    JSONManager --> LotFolders
    StagingManager --> StagingFolder
    Logger --> LogFiles

    FileSystem --> FinalLibrary
```

---

## **Mockups**

### Pantalla principal (inicio)

```
┌─────────────────────────────────────────────────────┐
│  📸 Media Purge                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📁 Carpeta a analizar:                              │
│  ┌───────────────────────────────────────────────┐ │
│  │                                                 │ │
│  │ [Seleccionar carpeta...]                       │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ⚙️ Configuración actual (toca el icono para cambiar)│
│  ┌───────────────────────────────────────────────┐ │
│  │  Tamaño de lote: 100 imágenes | 30 videos     │ │
│  │  Criterio: Fecha de creación                  │ │
│  │  Nombre biblioteca: Biblioteca_Final          │ │
│  │  Ubicación: (misma carpeta de origen)         │ │
│  │  Incluir subcarpetas: Sí                       │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  📊 Estimación de lotes:                            │
│  ┌───────────────────────────────────────────────┐ │
│  │  (se actualizará al seleccionar carpeta)      │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  📍 La biblioteca final se creará en la ubicación   │
│     configurada (por defecto, junto a la carpeta    │
│     de origen).                                      │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              ▶ Iniciar proceso               │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Ventana de configuración (modal)

```
┌─────────────────────────────────────────────────────┐
│  ⚙️ Configuración avanzada                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📦 Tamaño de lote:                                 │
│     Imágenes:  ┌─────┐  Videos:  ┌─────┐           │
│                │ 100 │           │ 30  │           │
│                └─────┘           └─────┘           │
│                                                     │
│  🔽 Criterio de orden:                              │
│     ◎ Fecha de creación    ○ Tamaño                 │
│                                                     │
│  📛 Nombre de biblioteca final:                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Biblioteca_Final                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  📂 Incluir subcarpetas:  [✔️] Sí                    │
│                                                     │
│  📍 Ubicación de la carpeta final:                  │
│  ┌───────────────────────────────────────────────┐ │
│  │ C:/Users/Usuario/                             │ │
│  └───────────────────────────────────────────────┘ │
│  [ Examinar... ]                                   │
│                                                     │
│  ┌─────────┐  ┌─────────┐                          │
│  │ Cancelar│  │ Guardar │                          │
│  └─────────┘  └─────────┘                          │
└─────────────────────────────────────────────────────┘
```

### Pantalla de revisión (swipe)

```
┌─────────────────────────────────────────────────────┐
│  📌 Lote: Imágenes 0001                     🔄 3/100│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │              🖼️ Vista previa                 │   │
│  │               de imagen/video               │   │
│  │                                             │   │
│  │         [Cargando desde ruta original]      │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  📄 Nombre: vacaciones.jpg                          │
│  💾 Tamaño: 4.2 MB   📅 Fecha: 2023-08-15          │
│                                                     │
│  ┌──────────┐    ┌────────┐    ┌──────────┐       │
│  │  ← Elim. │    │ Saltar │    │ Conservar→│       │
│  └──────────┘    └────────┘    └──────────┘       │
│                                                     │
│  ⌨️ Atajos:  ← (Eliminar)  → (Conservar)            │
│            ⬆️ ⬇️ (Navegar)  Enter (Conservar)       │
│            Delete (Eliminar)                        │
└─────────────────────────────────────────────────────┘
```

### Pantalla de resumen de lote (al cerrar)

```
┌─────────────────────────────────────────────────────┐
│  📊 Resumen del lote 0001                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ Conservados:  45 archivos  (120 MB)             │
│  🗑️ Eliminados:   55 archivos  (180 MB)             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Detalles:                                   │   │
│  │  - 30 imágenes conservadas (80 MB)           │   │
│  │  - 15 videos conservados (40 MB)             │   │
│  │  - 40 imágenes eliminadas (120 MB)           │   │
│  │  - 15 videos eliminados (60 MB)              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐                  │
│  │ Ver detalles│  │ Continuar   │                  │
│  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────┘
```

### Pantalla de progreso global (al finalizar)

```
┌─────────────────────────────────────────────────────┐
│  🎉 ¡Proceso completado!                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Resumen global:                                    │
│                                                     │
│     Archivos procesados: 323                        │
│     Espacio liberado:    320 MB                     │
│     Espacio en biblioteca: 1.25 GB                  │
│                                                     │
│  📁 Biblioteca final ubicada en:                    │
│  ┌───────────────────────────────────────────────┐ │
│  │ C:/Users/Usuario/Biblioteca_Final             │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  🧹 La carpeta temporal .media-purgue ha sido       │
│     eliminada.                                      │
│                                                     │
│  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │   Cerrar    │  │  Abrir Biblioteca_Final 📂  │  │
│  └─────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```
