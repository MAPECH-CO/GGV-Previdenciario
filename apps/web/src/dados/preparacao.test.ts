import { beforeEach, describe, expect, it } from 'vitest'
import { registrarConfirmacao } from './confirmacao.ts'
import { obterPreparacao, resumoDaIa, tarefasDaAdvogada } from './preparacao.ts'
import { configurarExemplo, gravar, ler, zerarExemplo } from './servidor.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

/** A ficha de atendimento da Josefa, como se o Atendimento tivesse salvo (a semente não inventa CPF). */
function josefaComFicha() {
  const banco = ler()
  const josefa = banco.fichas.find((f) => f.id === 'josefa-exemplo')!
  josefa.fichaAtendimentoPreenchida = true
  josefa.nascimento = '1950-02-01'
  josefa.fichaAtendimento = {
    data: '2026-10-05',
    origem: 'papel',
    modelo: 'GGV',
    pessoasNaCasa: 3,
    ultimaAtividade: 'auxiliar de limpeza, com carteira, até 05/2026',
    semTrabalharDesde: '06/2026',
    emBranco: ['Endereço', 'O que já pediu ao INSS'],
  }
  gravar(banco)
}

describe('Preparação da conversa · servidor de exemplo', () => {
  it('CA1 · a fila da advogada traz o "Preparar entrevista" com os pontos de atenção e as tarefas de exemplo', async () => {
    josefaComFicha()
    await registrarConfirmacao('josefa-entrevista', { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
    const fila = tarefasDaAdvogada()
    expect(fila[0]).toMatchObject({
      codigo: 'D1.06',
      acao: 'Preparar entrevista',
      detalhe: 'LOAS Idoso · entrevista hoje 15:30 · ficha já lida pela IA · atenção: sem senha do gov.br e campos em branco',
      urgente: true,
      href: '/entrevista/josefa-entrevista/preparar',
    })
    expect(fila.map((t) => t.cliente?.nome)).toEqual(['Josefa Exemplo', 'Maria Exemplo', 'Antônio Exemplo', 'Antônio Exemplo', 'Pedro Exemplo', 'Lúcia Exemplo'])
  })

  it('CA2, CA3 e CA5 · a preparação traz o resumo da IA, os pontos e a anotação do primeiro contato', async () => {
    josefaComFicha()
    const p = await obterPreparacao('josefa-entrevista')
    expect(p?.resumo).toBe(
      '76 anos · última atividade: auxiliar de limpeza, com carteira, até 05/2026 · sem trabalhar desde 06/2026 · 3 pessoas na casa · procura LOAS Idoso',
    )
    expect(p?.pontos.map((ponto) => ponto.texto)).toContain('Sem senha do gov.br · o Atendimento ainda não tentou renovar')
    expect(p?.primeiroContato).toEqual({ data: '2026-09-29', canal: 'WhatsApp', texto: 'Perguntou do LOAS; marcou a entrevista.' })
    expect(await obterPreparacao('nao-existe')).toBeNull()
  })

  it('CA3 · sem a ficha, o resumo diz que não há o que resumir; ficha de antes do portal manda ler o papel', async () => {
    const { fichas } = ler()
    const hoje = '2026-10-05'
    expect(resumoDaIa(fichas.find((f) => f.id === 'josefa-exemplo')!, hoje)).toBe('A ficha de atendimento ainda não foi preenchida: não há o que resumir.')
    expect(resumoDaIa(fichas.find((f) => f.id === 'antonio-exemplo')!, hoje)).toBe('Ficha preenchida antes do portal: leia a ficha em papel na pasta do cliente.')
  })
})
