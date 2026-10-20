import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Customer } from '../api/client'
import { fakeJwt } from '../staff/testing'
import { clearAccountSession, loadAccountSession, saveAccountSession } from './session'

const customer: Customer = {
  id: 1,
  email: 'anna@example.com',
  first_name: 'Anna',
  last_name: 'Russo',
  city: null,
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('sessione del cliente nel browser', () => {
  it('salva e rilegge il login', () => {
    const session = { token: fakeJwt(3600), customer }
    saveAccountSession(session)
    expect(loadAccountSession()).toEqual(session)
  })

  it('non riprende un token scaduto', () => {
    saveAccountSession({ token: fakeJwt(-10), customer })
    expect(loadAccountSession()).toBeNull()
  })

  it.each([
    ['non è JSON', 'xxx'],
    ['manca il cliente', JSON.stringify({ token: fakeJwt(3600) })],
    ['il cliente è incompleto', JSON.stringify({ token: fakeJwt(3600), customer: { id: 1 } })],
    ['il token non è una stringa', JSON.stringify({ token: 5, customer })],
  ])('ignora dati salvati malformati (%s)', (_nome, raw) => {
    localStorage.setItem('cg:account', raw)
    expect(loadAccountSession()).toBeNull()
  })

  it('esci cancella la memoria', () => {
    saveAccountSession({ token: fakeJwt(3600), customer })
    clearAccountSession()
    expect(loadAccountSession()).toBeNull()
  })

  it('se lo storage è bloccato non solleva errori', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloccato')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloccato')
    })
    expect(loadAccountSession()).toBeNull()
    expect(() => saveAccountSession({ token: fakeJwt(3600), customer })).not.toThrow()
  })
})
