import { describe, expect, it } from 'vitest'
import type { ArquivoDoPacote } from './pacote.ts'
import { travaCpf, travaPacote, travaTema350 } from './travas.ts'

const arquivo = (papel: ArquivoDoPacote['papel'], nome: string, id: string, origemId = id): ArquivoDoPacote => ({ documentoId: id, origemId, nome, hash: 'h', papel })
const PACOTE = [arquivo('peticao', 'peticao-inicial-v1.pdf', 'p'), arquivo('carta', 'carta.pdf', 'c'), arquivo('citado', 'laudo.pdf', 'l')]
const TRF3 = { nome: 'Justiça Federal', site: 'https://exemplo', tamanhoMaximoMb: 10 }

describe('travas antes de protocolar (G7, GGVP-71)', () => {
  it('Tema 350: a carta de indeferimento no pacote', () => {
    expect(travaTema350(PACOTE)).toMatchObject({ ok: true, evidencia: 'No pacote: carta.pdf' })
    expect(travaTema350(PACOTE.filter((a) => a.papel !== 'carta'))).toMatchObject({ ok: false, evidencia: 'A carta de indeferimento não está no pacote.' })
    expect(travaTema350(null).ok).toBe(false)
  })

  it('CPF: igual ao do cadastro, com ou sem pontuação; diferente, ausente ou sem cadastro falha, e a evidência mostra os dois', () => {
    expect(travaCpf('Autora, CPF 613.748.259-64, residente...', '61374825964')).toMatchObject({ ok: true, evidencia: 'Na petição: 613.748.259-64 · no cadastro: 613.748.259-64' })
    expect(travaCpf('CPF 61374825964 e de novo 613.748.259-64', '613.748.259-64').ok).toBe(true)
    expect(travaCpf('CPF 529.163.847-82', '613.748.259-64')).toMatchObject({ ok: false, evidencia: 'Na petição: 529.163.847-82 · no cadastro: 613.748.259-64' })
    expect(travaCpf('Sem CPF nenhum', '613.748.259-64')).toMatchObject({ ok: false, evidencia: 'A petição não traz o CPF do cliente (no cadastro: 613.748.259-64).' })
    expect(travaCpf('CPF 613.748.259-64', null)).toMatchObject({ ok: false, evidencia: 'O cadastro do cliente não tem um CPF válido.' })
  })

  it('CPF: número de processo, benefício ou valor no texto não é lido como CPF', () => {
    expect(travaCpf('Processo 0001234-96.2026.4.03.6301; NB 123.456.789-0; R$ 12.345.678,90', '613.748.259-64').evidencia).toBe(
      'A petição não traz o CPF do cliente (no cadastro: 613.748.259-64).',
    )
  })

  it('pacote completo: sem o que falta, sem o que não deu para ler e dentro do tamanho do tribunal', () => {
    const citados = [{ documentoId: 'l', nome: 'laudo.pdf' }]
    expect(travaPacote(citados, PACOTE, { p: 1000, c: 1000, l: 1000 }, TRF3)).toMatchObject({ ok: true, evidencia: '3 arquivos em PDF: peticao-inicial-v1.pdf, carta.pdf, laudo.pdf' })
    expect(travaPacote([...citados, { documentoId: null, nome: 'CNIS atualizado' }], PACOTE, {}, TRF3)).toMatchObject({ ok: false, evidencia: 'Falta: CNIS atualizado' })
    expect(travaPacote([{ documentoId: 'x', nome: 'foto.jpg' }], PACOTE, {}, TRF3)).toMatchObject({ ok: false, evidencia: 'Não deu para ler: foto.jpg' })
    expect(travaPacote(citados, PACOTE, { l: 12 * 1_048_576 }, TRF3)).toMatchObject({
      ok: false,
      evidencia: 'Grande demais para Justiça Federal: laudo.pdf (12 MB; o limite é 10 MB)',
    })
    expect(travaPacote(citados, null, {}, TRF3)).toMatchObject({ ok: false, evidencia: 'O pacote ainda não foi gerado.' })
  })

  it('pacote completo: a imagem convertida em PDF conta pelo documento de origem', () => {
    const convertido = [...PACOTE.slice(0, 2), arquivo('citado', 'foto.pdf', 'novo', 'foto')]
    expect(travaPacote([{ documentoId: 'foto', nome: 'foto.jpg' }], convertido, {}, TRF3).ok).toBe(true)
  })

  it('pacote completo (GGVP-107 CA6): com o Drive ligado, o pacote também tem de estar salvo lá', () => {
    const citados = [{ documentoId: 'l', nome: 'laudo.pdf' }]
    expect(travaPacote(citados, PACOTE, {}, TRF3, false)).toMatchObject({ ok: false, evidencia: 'O pacote ainda não está no Drive; o portal salva sozinho em até um minuto' })
    expect(travaPacote(citados, PACOTE, {}, TRF3, true).ok).toBe(true)
    expect(travaPacote(citados, PACOTE, {}, TRF3, null).ok).toBe(true) // Drive desligado: não cobra
  })
})
