// Cofre da senha do gov.br (G9, GGVP-103): AES-256-GCM na API. O banco só vê o texto cifrado e o IV;
// a chave vem da variável COFRE_CHAVE (32 bytes em base64) e nunca vai para o banco, o log ou o repositório.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export type SenhaCifrada = { senhaCifrada: Buffer; iv: Buffer }

/** Sem COFRE_CHAVE: em produção a API não sobe; na máquina do dev, uma chave fixa só para os dados de exemplo. */
export function chaveDoCofre(ambiente = process.env): Buffer {
  if (ambiente.COFRE_CHAVE) {
    const chave = Buffer.from(ambiente.COFRE_CHAVE, 'base64')
    if (chave.length !== 32) throw new Error('COFRE_CHAVE precisa ter 32 bytes em base64.')
    return chave
  }
  if (ambiente.NODE_ENV === 'production') throw new Error('Falta COFRE_CHAVE: o cofre do gov.br não abre sem ela.')
  return createHash('sha256').update('cofre-de-desenvolvimento-so-dados-de-exemplo').digest()
}

export function criarCofre(chave: Buffer) {
  return {
    cifrar(senha: string): SenhaCifrada {
      const iv = randomBytes(12)
      const cifra = createCipheriv('aes-256-gcm', chave, iv)
      const texto = Buffer.concat([cifra.update(senha, 'utf8'), cifra.final()])
      return { senhaCifrada: Buffer.concat([texto, cifra.getAuthTag()]), iv }
    },
    /** Falha se o texto foi mexido ou a chave é outra (a tag do GCM não confere). */
    decifrar({ senhaCifrada, iv }: SenhaCifrada): string {
      const tag = senhaCifrada.subarray(senhaCifrada.length - 16)
      const decifra = createDecipheriv('aes-256-gcm', chave, iv)
      decifra.setAuthTag(tag)
      return Buffer.concat([decifra.update(senhaCifrada.subarray(0, -16)), decifra.final()]).toString('utf8')
    },
  }
}

export type Cofre = ReturnType<typeof criarCofre>
