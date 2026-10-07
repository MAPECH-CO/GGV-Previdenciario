import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { armazenamentoLocal } from './armazenamento.ts'
import { chaveDoCofre, criarCofre } from './cofre.ts'

describe('cofre do gov.br (G9)', () => {
  const cofre = criarCofre(chaveDoCofre({}))

  it('cifra e decifra; o texto cifrado não contém a senha', () => {
    const guardada = cofre.cifrar('senha-do-gov-123')
    expect(guardada.senhaCifrada.toString('utf8')).not.toContain('senha-do-gov-123')
    expect(cofre.decifrar(guardada)).toBe('senha-do-gov-123')
  })

  it('texto mexido ou outra chave não abre', () => {
    const guardada = cofre.cifrar('senha-do-gov-123')
    const mexida = Buffer.from(guardada.senhaCifrada)
    mexida[0] ^= 1
    expect(() => cofre.decifrar({ ...guardada, senhaCifrada: mexida })).toThrow()
    const outra = criarCofre(chaveDoCofre({ COFRE_CHAVE: Buffer.alloc(32, 7).toString('base64') }))
    expect(() => outra.decifrar(guardada)).toThrow()
  })

  it('em produção, sem COFRE_CHAVE, não abre; chave de tamanho errado também não', () => {
    expect(() => chaveDoCofre({ NODE_ENV: 'production' })).toThrow('Falta COFRE_CHAVE')
    expect(() => chaveDoCofre({ COFRE_CHAVE: 'curta' })).toThrow('32 bytes')
  })
})

describe('armazenamento local', () => {
  it('guarda e lê; não sobrescreve; não sai da pasta', async () => {
    const arq = armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-')))
    await arq.salvar('caso-1/comprovante.pdf', Buffer.from('pdf'), 'application/pdf')
    expect((await arq.ler('caso-1/comprovante.pdf')).toString()).toBe('pdf')
    await expect(arq.salvar('caso-1/comprovante.pdf', Buffer.from('outro'), 'application/pdf')).rejects.toThrow()
    await expect(arq.salvar('../fora.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow('inválida')
  })
})
