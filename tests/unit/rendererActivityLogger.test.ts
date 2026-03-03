import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as ipc from '../../apps/renderer/src/ipc'
import { logEvent, logError, useActivityLogger } from '../../apps/renderer/src/logging/activityLogger'

describe('Renderer activity logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logEvent calls appendAppLog', async () => {
    const spy = vi.spyOn(ipc, 'appendAppLog').mockResolvedValue({ ok: true })
    await logEvent('/tmp/mp', 'ui:click', { btn: 'ok' })
    expect(spy).toHaveBeenCalledWith('/tmp/mp', { type: 'ui:click', data: { btn: 'ok' } })
  })

  it('logError calls appendAppLog with error payload', async () => {
    const spy = vi.spyOn(ipc, 'appendAppLog').mockResolvedValue({ ok: true })
    const err = new Error('boom')
    await logError('/tmp/mp', 'error:test', err, { ctx: 1 })
    expect(spy).toHaveBeenCalled()
    const args = spy.mock.calls[0]
    expect(args[0]).toBe('/tmp/mp')
    expect(args[1].type).toBe('error:test')
    expect(args[1].error.message).toBe('boom')
  })

  it('readEvents reads entries', async () => {
    const sample = [{ id: '1', timestamp: 't', type: 'a' }]
    vi.spyOn(ipc, 'readAppLog').mockResolvedValue({ ok: true, entries: sample })
    const { readEvents } = await import('../../apps/renderer/src/logging/activityLogger')
    const res = await readEvents('/tmp/mp')
    expect(res).toEqual(sample)
  })
})
