import { describe, expect, it } from 'vitest'
import { apareceNaFala } from './conversa.ts'

describe('GGVP-158 P6.6 · a IA só aponta o que foi dito', () => {
  it('o texto, palavra por palavra, sem acento nem caixa', () => {
    expect(apareceNaFala('endereco', 'Rua das Flores, 10', 'Mudei: agora moro na rua das flores, 10.')).toBe(true)
    expect(apareceNaFala('endereco', 'Rua das Palmeiras', 'Moro na Rua das Flores.')).toBe(false)
    expect(apareceNaFala('estadoCivil', 'Viúva', 'Fiquei viuva no ano passado.')).toBe(true)
    expect(apareceNaFala('estadoCivil', 'Casada', 'Eu casei mês passado.')).toBe(false)
  })

  it('o telefone pelos números, com ou sem o DDD', () => {
    expect(apareceNaFala('telefone', '11988887777', 'O número novo é (11) 98888-7777.')).toBe(true)
    expect(apareceNaFala('telefone', '11988887777', 'Anota: 98888 7777.')).toBe(true)
    expect(apareceNaFala('telefone', '11988887777', 'Troquei de número.')).toBe(false)
  })

  it('o e-mail escrito ou dito com "arroba" e "ponto"', () => {
    expect(apareceNaFala('email', 'maria.souza@gmail.com', 'É maria ponto souza arroba gmail ponto com')).toBe(true)
    expect(apareceNaFala('email', 'Maria@Exemplo.com', 'manda para maria@exemplo.com, por favor')).toBe(true)
    expect(apareceNaFala('email', 'maria@exemplo.com', 'tenho e-mail, depois eu passo')).toBe(false)
  })

  it('a data em números ou com o mês escrito; o dia sem o mês não basta', () => {
    expect(apareceNaFala('pericia', '16/11/2026', 'A perícia é dia 16/11.')).toBe(true)
    expect(apareceNaFala('pericia', '06/11/2026', 'Marcaram para 6 de novembro de 2026.')).toBe(true)
    expect(apareceNaFala('pericia', '16/11/2026', 'É no dia 16.')).toBe(false)
    expect(apareceNaFala('pericia', '16/11/2026', 'É dia 16 de outubro.')).toBe(false)
  })

  it('o fato novo e o documento citado ficam fora: o valor é o resumo da fala', () => {
    expect(apareceNaFala('fato', 'Foi internada em agosto', 'Fiquei no hospital em agosto.')).toBe(true)
    expect(apareceNaFala('documento', 'comprovante de endereço', 'Tenho a conta de luz.')).toBe(true)
  })

  it('texto grande roda em tempo linear', () => {
    const fala = 'rua '.repeat(50_000)
    const inicio = performance.now()
    expect(apareceNaFala('endereco', 'Rua das Palmeiras', fala)).toBe(false)
    expect(apareceNaFala('pericia', '16/11/2026', fala)).toBe(false)
    expect(performance.now() - inicio).toBeLessThan(1000)
  })
})
