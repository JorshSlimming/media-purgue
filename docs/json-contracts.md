# Contratos JSON — Media Purgue

Resumen de los formatos JSON usados por la aplicación (contratos que deben respetar Main y Renderer).

1) `usuario.json` (configuración del usuario)

Ejemplo mínimo:

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

2) `lote_XXXX.json` (un archivo JSON por lote en `01_Procesando/...`)

Estructura:

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

`estado` debe ser: `pendiente`, `conservar` o `eliminar`.

3) `lote_XXXX.log` (registro por lote en carpeta `Logs/`)

Formato libre pero recomendado: arreglo de entradas con `timestamp`, `tipo` y `mensaje`.

Ejemplo resumido (texto):

```
2024-01-02T12:00:00Z INFO Copiados 45 archivos a .staging (120 MB)
2024-01-02T12:00:05Z INFO Movidos a Biblioteca_Final (atomic)
2024-01-02T12:00:06Z ERROR No se pudo eliminar C:/.../archivo.jpg -> permiso denegado
```

4) `global.json` (resumen final dentro de la Biblioteca Final)

Ejemplo:

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

Contractos TypeScript

- Ver `packages/shared-types/src/index.ts` para las interfaces `Lote`, `LoteArchivo`, `UsuarioConfig`, `LogLote` y `GlobalSummary`.
