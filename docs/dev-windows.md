# Desarrollo en Windows — pasos rápidos

Requisitos:
- Node.js 18+ instalado
- Git

Instalación de dependencias (desde la raíz del repo):

```powershell
npm install
```

Ejecutar en modo desarrollo (lanza Vite, compila main y arranca Electron):

```powershell
npm run dev
```

Qué hace cada script:
- `dev`: ejecuta simultáneamente `dev:renderer`, `dev:main:watch` y `dev:electron`.
- `dev:renderer`: arranca el servidor Vite en `http://localhost:5173`.
- `dev:main:watch`: compila en modo watch `apps/electron-main` a `apps/electron-main/dist`.
- `dev:electron`: espera a que Vite responda y arranca Electron apuntando al build del main.

Notas específicas para Windows:
- Si PowerShell bloquea la ejecución de scripts, ejecutar: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` con permisos de administrador.
- Asegúrate de tener `electron` y `wait-on` instalados localmente (se instalan con `npm install`).

Próximos pasos:
- Configurar `vite` para generar el `index.html` y el `bundle` del renderer.
- Añadir `build` para empaquetar con `electron-builder` (configurar `appId`, `directories`, y `win` en `package.json`).
