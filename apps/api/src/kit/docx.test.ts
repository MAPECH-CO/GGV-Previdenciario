import { describe, expect, it } from 'vitest'
import { docxDeTeste, textoDoDocx } from './docx-de-teste.ts'
import { MSG_SEM_VARIAVEL, lerModelo, preencherModelo } from './docx.ts'

describe('GGVP-136 CA3 · preencher o modelo do Word', () => {
  it('troca cada variável, mesmo partida em pedaços pelo Word, e deixa o resto do texto como está', () => {
    const modelo = docxDeTeste(['Eu, {{NOME |COMPLETO}}, CPF {{NÚMERO DO C|PF}}, moro na {{ENDEREÇO COMPLETO}} nº{{Nº}}.', 'Texto fixo do escritório.'])
    const kit = preencherModelo(modelo, { 'NOME COMPLETO': 'Maria de Exemplo', 'NÚMERO DO CPF': '529.982.247-25', 'ENDEREÇO COMPLETO': 'Rua das Flores', Nº: '10' }, '2026-10-09')
    expect(textoDoDocx(kit)).toBe('Eu, Maria de Exemplo, CPF 529.982.247-25, moro na Rua das Flores nº10.\nTexto fixo do escritório.')
  })

  it('o que não tem valor sai em branco, e "&" e "<" no dado saem escapados: o arquivo continua abrindo', () => {
    const modelo = docxDeTeste(['Contato: {{TELEFONE P/ CONTATO}}. Nome: {{NOME COMPLETO}}.'])
    const kit = preencherModelo(modelo, { 'NOME COMPLETO': 'Ana & Cia <exemplo>' }, '2026-10-09')
    expect(textoDoDocx(kit)).toBe('Contato: . Nome: Ana & Cia &lt;exemplo&gt;.')
    // O kit preenchido ainda é um documento do Word que abre; só não tem mais variável.
    expect(lerModelo(kit)).toEqual({ ok: false, erro: MSG_SEM_VARIAVEL })
  })

  it('CA5 · só a primeira {{DATA DE HOJE}}, a do contrato de honorários, leva a data; as outras ficam em branco, com o ano', () => {
    const modelo = docxDeTeste(['CONTRATO.', 'São Paulo, {{DATA DE HOJE}}.', 'PROCURAÇÃO.', '{{CIDADE}}, {{DATA DE HOJE}}.', 'DECLARAÇÃO.', '{{CIDADE}}, {{DATA DE HOJE}}'])
    const kit = preencherModelo(modelo, { CIDADE: 'Osasco', 'DATA DE HOJE': '9 de outubro de 2026' }, '2026-10-09')
    expect(textoDoDocx(kit).split('\n')).toEqual([
      'CONTRATO.',
      'São Paulo, 9 de outubro de 2026.',
      'PROCURAÇÃO.',
      'Osasco, dia ____________ de ________________ de 2026.',
      'DECLARAÇÃO.',
      'Osasco, dia ____________ de ________________ de 2026',
    ])
  })

  it('o nome da variável com o acento solto, como o Word guarda, também é preenchido', () => {
    const kit = preencherModelo(docxDeTeste(['RG {{NÚMERO DO RG}}']), { 'NÚMERO DO RG': '12.345.678-9' }, '2026-10-09')
    expect(textoDoDocx(kit)).toBe('RG 12.345.678-9')
  })

  it('o modelo continua o mesmo arquivo do Word: o kit preenchido abre com o que o portal lê', () => {
    const kit = preencherModelo(docxDeTeste(['{{NOME COMPLETO}}']), { 'NOME COMPLETO': 'Maria de Exemplo' }, '2026-10-09')
    expect(kit.subarray(0, 2).toString()).toBe('PK')
  })
})

describe('GGVP-136 CA1 · ler o modelo', () => {
  it('devolve as variáveis na ordem em que aparecem, sem repetir', () => {
    const modelo = docxDeTeste(['{{NOME COMPLETO}}, {{NÚMERO DO CPF}}', 'de novo {{NOME COMPLETO}} e {{DATA DE HOJE}}'])
    expect(lerModelo(modelo)).toEqual({ ok: true, variaveis: ['NOME COMPLETO', 'NÚMERO DO CPF', 'DATA DE HOJE'] })
  })
})
