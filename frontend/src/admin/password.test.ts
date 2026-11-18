import { describe, expect, it } from 'vitest'
import { generatePassword } from './password'

describe('generatePassword', () => {
  it('rispetta la lunghezza e non usa caratteri ambigui', () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword()
      expect(password).toHaveLength(16)
      expect(password).toMatch(/^[a-zA-Z0-9]+$/)
      expect(password).not.toMatch(/[01OlI]/)
    }
    expect(generatePassword(24)).toHaveLength(24)
  })

  it('non ripete lo stesso valore', () => {
    expect(new Set(Array.from({ length: 20 }, () => generatePassword())).size).toBe(20)
  })
})
