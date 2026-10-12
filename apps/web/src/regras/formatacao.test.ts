import { describe, expect, it } from 'vitest'
import { lerFormatacao, lerTrechos } from './formatacao.ts'

const t = (texto: string) => ({ tipo: 'texto', texto })

describe('o texto formatado da IA (12/10)', () => {
  it('negrito, itálico, código e link do portal; link de fora vira só o texto', () => {
    expect(lerTrechos('**Ana** tem *duas* tarefas e _uma_ `G13`')).toEqual([
      { tipo: 'negrito', filhos: [t('Ana')] },
      t(' tem '),
      { tipo: 'italico', filhos: [t('duas')] },
      t(' tarefas e '),
      { tipo: 'italico', filhos: [t('uma')] },
      t(' '),
      { tipo: 'codigo', texto: 'G13' },
    ])
    expect(lerTrechos('abra [o caso](/casos/1)')).toEqual([t('abra '), { tipo: 'link', href: '/casos/1', filhos: [t('o caso')] }])
    expect(lerTrechos('veja [aqui](https://fora.com) e [lá](//fora.com)')).toEqual([t('veja aqui e lá')])
  })

  it('link com barra invertida não passa por interno (o navegador lê /\\x.com como outro site)', () => {
    expect(lerTrechos('[a](/\\evil.com) [b](/casos\\x) [c](javascript:void)')).toEqual([t('a b c')])
  })

  it('asterisco solto e marcação sem fechar ficam como texto', () => {
    expect(lerTrechos('art. 20 * 3 e **sem fechar')).toEqual([t('art. 20 * 3 e **sem fechar')])
    expect(lerTrechos('nome_do_arquivo.pdf')).toEqual([t('nome_do_arquivo.pdf')])
  })

  it('parágrafos, quebra de linha e títulos', () => {
    expect(lerFormatacao('Oi.\nTudo bem?\n\n### Hoje\n#### Detalhe')).toEqual([
      { tipo: 'paragrafo', linhas: [[t('Oi.')], [t('Tudo bem?')]] },
      { tipo: 'titulo', nivel: 3, trechos: [t('Hoje')] },
      { tipo: 'titulo', nivel: 4, trechos: [t('Detalhe')] },
    ])
    expect(lerFormatacao('# Grande')).toEqual([{ tipo: 'titulo', nivel: 3, trechos: [t('Grande')] }])
  })

  it('listas com e sem número, com um nível de recuo', () => {
    expect(lerFormatacao('- um\n  - um.a\n- dois\n\n1. primeiro\n2) segundo')).toEqual([
      { tipo: 'lista', ordenada: false, itens: [{ trechos: [t('um')], filhos: [[t('um.a')]] }, { trechos: [t('dois')], filhos: [] }] },
      { tipo: 'lista', ordenada: true, inicio: 1, itens: [{ trechos: [t('primeiro')], filhos: [] }, { trechos: [t('segundo')], filhos: [] }] },
    ])
  })

  it('lista numerada com linha em branco entre os itens continua uma lista só; cortada, segue o número', () => {
    const lista = lerFormatacao('1. a\n\n2. b\n\n3. c')
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ tipo: 'lista', ordenada: true, inicio: 1 })
    expect((lista[0] as { itens: unknown[] }).itens).toHaveLength(3)
    expect(lerFormatacao('3. c\n4. d')[0]).toMatchObject({ tipo: 'lista', ordenada: true, inicio: 3 })
  })

  it('tabela do GitHub, com linhas tortas completadas e no máximo 6 colunas', () => {
    expect(lerFormatacao('| O quê | Quem |\n|---|:--:|\n| Perícia | Jurídico |\n| Notas |\n| a | b | c |')).toEqual([
      {
        tipo: 'tabela',
        cabeca: [[t('O quê')], [t('Quem')]],
        linhas: [
          [[t('Perícia')], [t('Jurídico')]],
          [[t('Notas')], []],
          [[t('a')], [t('b')]],
        ],
      },
    ])
    const larga = `|${'a|'.repeat(8)}\n|${'-|'.repeat(8)}`
    expect((lerFormatacao(larga)[0] as { cabeca: unknown[] }).cabeca).toHaveLength(6)
  })

  it('linha com barra sem a linha de traços é parágrafo; HTML fica como texto', () => {
    expect(lerFormatacao('| só isso |')).toEqual([{ tipo: 'paragrafo', linhas: [[t('| só isso |')]] }])
    expect(lerFormatacao('<b>oi</b>')).toEqual([{ tipo: 'paragrafo', linhas: [[t('<b>oi</b>')]] }])
  })
})
