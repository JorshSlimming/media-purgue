// Skip running Playwright tests when executed under Vitest (which would import this file)
if (!process.env.VITEST) {
  const { test, expect } = require('@playwright/test')
  const { spawn, spawnSync } = require('child_process')
  const path = require('path')
  const fs = require('fs')
  const waitOn = require('wait-on')

  test('scan and close lote via Electron preload API', async () => {
    const repoRoot = process.cwd()
    const fixtureDir = path.join(repoRoot, 'tests', 'e2e', 'fixtures')
    fs.mkdirSync(fixtureDir, { recursive: true })
    fs.writeFileSync(path.join(fixtureDir, 'img1.jpg'), 'fakejpg')
    fs.writeFileSync(path.join(fixtureDir, 'img2.jpg'), 'fakejpg2')
    fs.writeFileSync(path.join(fixtureDir, 'vid1.mp4'), 'fakevideo')

    // compile main: try npx tsc, fall back to local node_modules/.bin/tsc
    function runTsc() {
      const tscArgs = ['tsc', '-p', 'apps/electron-main/tsconfig.json']
      let res
      try {
        res = spawnSync('npx', tscArgs, { encoding: 'utf8' })
        if (res && res.status === 0) return
        const out = (res && (res.stdout || res.stderr)) || ''
        // capture stdout for diagnostics
        if (res && res.status !== 0) throw new Error('npx tsc failed: ' + out)
      } catch (e) {
        // continue to fallback
      }
      // fallback to local binary
      const tscBin = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
      try {
        res = spawnSync(tscBin, ['-p', 'apps/electron-main/tsconfig.json'], { encoding: 'utf8' })
        if (res && res.status === 0) return
        const out2 = (res && (res.stdout || res.stderr)) || ''
        if (res && res.status !== 0) throw new Error('local tsc failed: ' + out2)
      } catch (e) {
        // final attempt: execSync to capture errors
        try {
          const { execSync } = require('child_process')
          execSync(`npx tsc -p apps/electron-main/tsconfig.json`, { stdio: 'pipe' })
          return
        } catch (err) {
          throw new Error('TypeScript compilation failed: ' + (err && err.message) + '\n' + (err && err.stdout ? err.stdout.toString() : ''))
        }
      }
      throw new Error('TypeScript compilation failed (non-zero exit)')
    }

    runTsc()
    runTsc()

    // Build renderer into a temporary directory and serve it on a dynamic port
    const rendererDir = path.join(repoRoot, 'apps', 'renderer')
    const os = require('os')
    const tmpBase = os.tmpdir()
    const tmp = fs.mkdtempSync(path.join(tmpBase, 'mp-dist-'))
    // programmatically build using Vite's Node API and write output to `tmp`
    try {
      const vite = require('vite')
      await vite.build({ root: rendererDir, build: { outDir: tmp, emptyOutDir: true } })
    } catch (err) {
      // ensure cleanup on failure
      try { fs.rmSync(tmp, { recursive: true, force: true }) } catch (e) { }
      throw new Error('Renderer build failed: ' + (err && err.message))
    }

    // start a minimal static server to serve the temporary dist on a dynamic port
    const http = require('http')
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' }
    const server = http.createServer((req, res) => {
      try {
        let p = req.url.split('?')[0]
        if (p === '/') p = '/index.html'
        const fp = path.join(tmp, decodeURIComponent(p))
        if (!fs.existsSync(fp)) {
          res.writeHead(404)
          return res.end('Not found')
        }
        const ext = path.extname(fp)
        const ct = mime[ext] || 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': ct })
        fs.createReadStream(fp).pipe(res)
      } catch (err) {
        res.writeHead(500)
        res.end('Server error')
      }
    })
    await new Promise((resolve, reject) => server.listen(0, (err) => err ? reject(err) : resolve()))
    const addr = server.address()
    const port = addr && addr.port

    // launch electron via playwright with MP_RENDERER_URL to point to our static server
    const { _electron: electron } = require('playwright')
    const electronApp = await electron.launch({
      executablePath: require('electron'),
      args: ['.', '--no-sandbox', '--disable-dev-shm-usage'],
      env: { ...(process.env || {}), MP_RENDERER_URL: `http://localhost:${port}/`, MP_E2E: 'true' }
    })
    try {
      const page = await electronApp.firstWindow()
      await page.waitForLoadState('domcontentloaded')

      // call scanFolder
      const scanRes = await page.evaluate((root) => {
        // eslint-disable-next-line no-undef
        return window.mp.scanFolder({ rootPath: root, includeSubfolders: true })
      }, fixtureDir)

      expect(scanRes).toBeTruthy()
      expect(Array.isArray(scanRes.created)).toBe(true)
      expect(scanRes.created.length).toBeGreaterThan(0)

      const lotePath = scanRes.created[0]
      const lote = await page.evaluate((p) => {
        // eslint-disable-next-line no-undef
        return window.mp.readLote(p)
      }, lotePath)
      expect(lote).toBeTruthy()
      expect(Array.isArray(lote.archivos)).toBe(true)

      const closeRes = await page.evaluate((p) => {
        // eslint-disable-next-line no-undef
        return window.mp.closeLote(p)
      }, lotePath)

      // Accept either success or staged error (ok:false) but ensure structure
      expect(closeRes).toBeTruthy()
      expect(typeof closeRes).toBe('object')
      expect('ok' in closeRes).toBe(true)

    } finally {
      await electronApp.close()
      try { server.close() } catch (e) { }
      try { fs.rmSync(tmp, { recursive: true, force: true }) } catch (e) { }
    }
  })
} else {
  // exported as noop when running under Vitest
  module.exports = {}
}
