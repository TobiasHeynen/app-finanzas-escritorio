import { describe, expect, it, vi } from 'vitest'
import { dispatch } from '@core/api/dispatch'
import { AppError } from '@shared/errors'
import { IPC_CHANNELS } from '@shared/ipc/channels'
import { ipcContract } from '@shared/ipc/contract'

const pingOutput = {
  reply: 'pong: hola',
  receivedAt: '2026-10-01T12:00:00.000Z',
  versions: { app: '0.1.0', electron: '44.5.1', node: '22.0.0' },
}

describe('contrato IPC', () => {
  it('la lista blanca del preload coincide con el contrato', () => {
    expect([...IPC_CHANNELS].sort()).toEqual(Object.keys(ipcContract).sort())
  })
})

describe('dispatch', () => {
  it('valida el input y devuelve ok con los datos del handler', async () => {
    const handler = vi.fn(() => pingOutput)
    const result = await dispatch('app:ping', handler, { message: '  hola  ' })
    expect(result).toEqual({ ok: true, data: pingOutput })
    // zod aplica las transformaciones del schema (trim) antes de llegar al handler
    expect(handler).toHaveBeenCalledWith({ message: 'hola' })
  })

  it('rechaza input inválido sin llamar al handler', async () => {
    const handler = vi.fn(() => pingOutput)
    const result = await dispatch('app:ping', handler, { message: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION')
      expect(result.error.fields).toHaveProperty('message')
    }
    expect(handler).not.toHaveBeenCalled()
  })

  it('rechaza propiedades extra (schemas estrictos)', async () => {
    const result = await dispatch('app:ping', () => pingOutput, { message: 'hola', admin: true })
    expect(result.ok).toBe(false)
  })

  it('rechaza payloads que no son objetos', async () => {
    for (const raw of [null, undefined, 'hola', 42, []]) {
      const result = await dispatch('app:ping', () => pingOutput, raw)
      expect(result.ok).toBe(false)
    }
  })

  it('propaga AppError con su código y mensaje', async () => {
    const result = await dispatch(
      'app:ping',
      () => {
        throw new AppError('CONFLICT', 'Ya existe')
      },
      { message: 'hola' },
    )
    expect(result).toEqual({ ok: false, error: { code: 'CONFLICT', message: 'Ya existe' } })
  })

  it('oculta los errores inesperados detrás de INTERNAL y los loguea', async () => {
    const log = vi.fn()
    const result = await dispatch(
      'app:ping',
      () => {
        throw new Error('detalle interno con /ruta/secreta')
      },
      { message: 'hola' },
      log,
    )
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Ocurrió un error inesperado' },
    })
    expect(log).toHaveBeenCalledOnce()
  })
})
