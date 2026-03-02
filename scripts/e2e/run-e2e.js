#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const waitOn = require('wait-on')
;(async () => {
  const repoRoot = process.cwd()
  const fixtureDir = path.join(repoRoot, 'tests', 'e2e', 'fixtures')
  try {
    fs.mkdirSync(fixtureDir, { recursive: true })
    // create small sample files
    fs.writeFileSync(path.join(fixtureDir, 'img1.jpg'), 'fakejpg')
    fs.writeFileSync(path.join(fixtureDir, 'img2.jpg'), 'fakejpg2')
    fs.writeFileSync(path.join(fixtureDir, 'vid1.mp4'), 'fakevideo')
  } catch (err) {
    console.error('Failed to prepare fixtures', err)
    process.exit(1)
  }

  console.log('Compiling main (tsc)...')
  try {
    spawnSync('npx', ['tsc', '-p', 'apps/electron-main/tsconfig.json'], { stdio: 'inherit' })
  } catch (err) {
    console.error('tsc failed', err)
    process.exit(1)
  }

  console.log('Starting Vite dev server...')
  const viteProc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
    cwd: path.join(repoRoot, 'apps', 'renderer'),
    stdio: ['ignore', 'pipe', 'pipe']
  })
  viteProc.stdout.on('data', d => process.stdout.write('[vite] ' + d))
  viteProc.stderr.on('data', d => process.stderr.write('[vite] ' + d))

  try {
    await waitOn({ resources: ['http://localhost:5173'], timeout: 120000 })
  } catch (err) {
    console.error('Vite did not start in time', err)
    viteProc.kill()
    process.exit(1)
  }

  console.log('Launching Electron via Playwright...')
  const { _electron: electron } = require('playwright')
  let electronApp
  try {
    electronApp = await electron.launch({ executablePath: require('electron'), args: ['.'] })
  } catch (err) {
    console.error('Failed to launch Electron', err)
    viteProc.kill()
    process.exit(1)
  }

  try {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    console.log('Calling scanFolder via preload API...')
    const scanRes = await page.evaluate((root) => {
      // @ts-ignore
      return window.mp.scanFolder({ rootPath: root, includeSubfolders: true })
    }, fixtureDir)

    console.log('Scan result:', scanRes)
    if (!scanRes || !scanRes.created || scanRes.created.length === 0) {
      throw new Error('No lotes created in scan')
    }

    const lotePath = scanRes.created[0]
    console.log('Reading lote', lotePath)
    const lote = await page.evaluate((p) => {
      // @ts-ignore
      return window.mp.readLote(p)
    }, lotePath)
    console.log('Lote read, archivos:', lote?.archivos?.length)

    console.log('Attempting to close lote:', lotePath)
    const closeRes = await page.evaluate((p) => {
      // @ts-ignore
      return window.mp.closeLote(p)
    }, lotePath)
    console.log('Close result:', closeRes)

    if (closeRes && closeRes.ok) console.log('E2E: closeLote succeeded')
    else console.warn('E2E: closeLote returned error or staged result', closeRes)

  } catch (err) {
    console.error('E2E test encountered an error:', err)
    try { await electronApp.close() } catch (e) {}
    viteProc.kill()
    process.exit(1)
  }

  console.log('Cleaning up: closing Electron and killing Vite')
  try { await electronApp.close() } catch (e) {}
  viteProc.kill()
  console.log('E2E run complete')
  process.exit(0)
})()
