import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// RULES.md 7 ve 9: motor saf kalmalı. ESLint'e ek olarak testle de denetlenir.
const ENGINE_DIR = join(import.meta.dirname, '..', 'src', 'engine')
const FORBIDDEN = [/Math\.random/, /from ['"]react/, /\bwindow\./, /\bdocument\./, /localStorage/, /setTimeout|setInterval/]

describe('motor saflığı', () => {
  const files = readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts'))

  it('motor dosyaları bulundu', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    it(`${file} yasaklı API kullanmıyor`, () => {
      const code = readFileSync(join(ENGINE_DIR, file), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n')
      for (const pattern of FORBIDDEN) expect(pattern.test(code)).toBe(false)
    })
  }
})
