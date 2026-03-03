import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import { saveUsuarioConfigHandler } from '../../apps/electron-main/src/handlers/saveUsuarioConfig'
import { ActivityLogger } from '../../apps/electron-main/src/activityLogger'

let tmp = ''
beforeEach(async () => { tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'mp-save-')) })
afterEach(async () => { if (tmp) await fsp.rm(tmp, { recursive: true, force: true }) })

describe('saveUsuarioConfigHandler', () => {
  it('writes usuario.json and logs config:saved', async () => {
    const cfg = { nombre_biblioteca: 'Prueba', tamano_lote_imagenes: 5 }
    const res: any = await saveUsuarioConfigHandler(tmp, cfg)
    expect(res.ok).toBe(true)
    const mpRoot = path.join(tmp, '.media-purgue')
    const cfgPath = path.join(mpRoot, 'Config', 'usuario.json')
    const txt = await fsp.readFile(cfgPath, 'utf8')
    expect(JSON.parse(txt).nombre_biblioteca).toBe('Prueba')

    const logger = new ActivityLogger(path.resolve(mpRoot, '..'))
    const events = await logger.readEvents()
    expect(events.some(e => e.type === 'config:saved')).toBe(true)
  })
})
