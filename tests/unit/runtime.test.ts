import { describe, expect, it } from 'vitest'

describe('runtime de tests', () => {
  // Los módulos nativos se compilan para el ABI de Electron: los tests tienen que correr ahí.
  it('corre adentro del Node de Electron', () => {
    expect(process.versions.electron).toBeTypeOf('string')
  })
})
