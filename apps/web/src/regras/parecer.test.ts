import { describe, expect, it } from 'vitest'
import { roteirosDeExemplo } from '../dados/roteiro.ts'
import {
  abaixoDe24Meses,
  abordarSugerido,
  analisar,
  mensagemDoComplemento,
  mesesEntre,
  motivoParaNaoAprovarDispensa,
  motivoParaNaoPedirDispensa,
  motivoParaNaoRegistrar,
  orientacaoAoMedico,
  mudancas,
  problemaG20,
  recusaDoChat,
  situacaoFinal,
  type Conferidos,
  type LeituraMedica,
} from './parecer.ts'
import { emVigor, type ItemDoRoteiro } from './roteiro.ts'

const itens: ItemDoRoteiro[] = [
  { id: 'natureza', tipo: 'obrigatorio', texto: 'Natureza do impedimento', pergunta: 'Qual é a natureza do impedimento do paciente?' },
  { id: 'prognostico', tipo: 'obrigatorio', texto: 'Prognóstico', pergunta: 'Qual a previsão de duração do quadro?' },
  { id: 'menos-de-24-meses', tipo: 'contradicao', texto: 'Menos de 24 meses' },
  { id: 'gastos', tipo: 'complementar', texto: 'Provas de gastos' },
]

const leitura = (id: string, data: string, cobre: string[], contradiz: string[] = []): LeituraMedica => ({
  documentoId: id,
  documento: `Laudo médico · ${data}`,
  data,
  cobre: Object.fromEntries(cobre.map((c) => [c, { pagina: 1, trecho: `(exemplo) trecho de ${id} sobre ${c}` }])),
  contradiz: Object.fromEntries(contradiz.map((c) => [c, { pagina: 2, trecho: `(exemplo) ${c} em ${id}` }])),
})

describe('Parecer de suficiência (GGVP-20)', () => {
  it('CA1 · cada item obrigatório presente ou ausente, com o documento, a página e o trecho do mais novo que o cobre', () => {
    const r = analisar(itens, [leitura('velho', '2026-01-10', ['natureza']), leitura('novo', '2026-08-20', ['natureza'])])
    expect(r.itens.map((i) => [i.id, i.situacao, i.evidencia?.documentoId, i.evidencia?.pagina])).toEqual([
      ['natureza', 'presente', 'novo', 1],
      ['prognostico', 'ausente', undefined, undefined],
      ['menos-de-24-meses', 'ausente', undefined, undefined],
    ])
    expect(r.itens[0].evidencia?.trecho).toBe('(exemplo) trecho de novo sobre natureza')
    expect(r.sugestao).toBe('insuficiente')
    expect(analisar(itens, [leitura('a', '2026-08-20', ['natureza', 'prognostico'])]).sugestao).toBe('suficiente')
  })

  it('CA2 · contradição encontrada deixa a sugestão Contraditório, mesmo com tudo presente (G18)', () => {
    const r = analisar(itens, [leitura('a', '2026-08-20', ['natureza', 'prognostico'], ['menos-de-24-meses'])])
    expect(r.itens[2]).toMatchObject({ situacao: 'contraditorio', evidencia: { pagina: 2 } })
    expect(r.sugestao).toBe('contraditorio')
  })

  it('CA2 · a regra dos 24 meses do LOAS é código (G19)', () => {
    expect(mesesEntre('2025-01', '2026-12')).toBe(23)
    expect(mesesEntre('2025-01-15', '2027-01-14')).toBe(23)
    expect(mesesEntre('2025-01-15', '2027-01-15')).toBe(24)
    expect(abaixoDe24Meses('2025-01', '2026-12')).toBe(true)
    expect(abaixoDe24Meses('2025-01', '2027-01')).toBe(false)
    expect(abaixoDe24Meses('2019-03', undefined)).toBe(false)
  })

  it('CA4 · o que mudou: o documento novo e cada item que passou a ser coberto ou contraditório', () => {
    const antes = analisar(itens, [leitura('a', '2026-08-20', ['natureza'])]).itens
    const depois = analisar(itens, [leitura('a', '2026-08-20', ['natureza']), leitura('b', '2026-10-06', ['prognostico'], ['menos-de-24-meses'])]).itens
    expect(mudancas(antes, depois, ['Laudo médico · 06/10/2026'])).toEqual([
      'Documento novo: Laudo médico · 06/10/2026',
      'Passa a cobrir: Prognóstico',
      'Nova contradição: Menos de 24 meses',
    ])
    expect(mudancas(undefined, depois, [])).toEqual([])
  })

  it('CA7 e CA8 · o G20 recusa CID, diagnóstico, grau, conclusão e frase pronta', () => {
    expect(problemaG20('Qual a previsão de duração do quadro?')).toBeNull()
    expect(problemaG20('Informar M54.5')).toMatch(/CID/)
    expect(problemaG20('incluir o CID')).toMatch(/CID/)
    expect(problemaG20('confirmar o diagnóstico de lombalgia')).toMatch(/diagnóstico/)
    expect(problemaG20('dizer que é grau moderado')).toMatch(/grau/)
    expect(problemaG20('atestar incapacidade total')).toMatch(/conclusão/)
    expect(problemaG20('Coloque "sem condições de trabalho"')).toMatch(/aspas/)
    expect(problemaG20('escreva que o paciente não pode trabalhar')).toMatch(/frase pronta/)
  })

  it('CA8 · as perguntas de todos os roteiros da semente passam no G20', () => {
    const perguntas = roteirosDeExemplo().flatMap((r) => emVigor(r).itens.flatMap((i) => (i.pergunta ? [i.pergunta] : [])))
    expect(perguntas.length).toBeGreaterThan(30)
    expect(perguntas.filter((p) => problemaG20(p) !== null)).toEqual([])
  })

  it('CA5 e CA8 · a IA sugere o que o documento deve abordar com as perguntas dos itens ausentes, e os complementares na contradição', () => {
    const r = analisar(itens, [leitura('a', '2026-08-20', ['natureza'], ['menos-de-24-meses'])])
    expect(abordarSugerido(r.itens, ['Provas de gastos'])).toBe(
      'O relatório médico precisa responder:\n• Qual a previsão de duração do quadro?\n\nDocumentos que ajudam: Provas de gastos.',
    )
    expect(problemaG20(abordarSugerido(r.itens, ['Provas de gastos']))).toBeNull()
  })

  it('CA3 e CA8 · registrar só com cada item conferido, a decisão e, no Insuficiente, o campo do G20', () => {
    const r = analisar(itens, [leitura('a', '2026-08-20', ['natureza'])])
    const base = { itens: r.itens, conferidos: {} as Conferidos, abordar: '', semRoteiro: false, conferenciaManual: '' }
    expect(motivoParaNaoRegistrar(base)).toBe('Confira cada item: confirme o que a IA achou ou corrija.')
    const conferidos: Conferidos = { natureza: 'presente', prognostico: 'ausente', 'menos-de-24-meses': 'ausente' }
    expect(motivoParaNaoRegistrar({ ...base, conferidos })).toBe('Responda: a documentação médica é suficiente para o benefício?')
    expect(motivoParaNaoRegistrar({ ...base, conferidos, decisao: 'suficiente' })).toBe('Para "Suficiente", todo item obrigatório tem de estar presente.')
    expect(motivoParaNaoRegistrar({ ...base, conferidos, decisao: 'insuficiente' })).toBe('Escreva o que o documento deve abordar (G20).')
    expect(motivoParaNaoRegistrar({ ...base, conferidos, decisao: 'insuficiente', abordar: 'Confirmar o CID M54.5 no relatório' })).toMatch(/CID/)
    expect(motivoParaNaoRegistrar({ ...base, conferidos, decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' })).toBeNull()
    // A advogada corrige: o prognóstico estava, sim, no laudo.
    expect(motivoParaNaoRegistrar({ ...base, conferidos: { ...conferidos, prognostico: 'presente' }, decisao: 'suficiente' })).toBeNull()
  })

  it('CA2 · com contradição conferida, o parecer fica Contraditório e "Suficiente" não registra', () => {
    const r = analisar(itens, [leitura('a', '2026-08-20', ['natureza', 'prognostico'], ['menos-de-24-meses'])])
    const conferidos: Conferidos = { natureza: 'presente', prognostico: 'presente', 'menos-de-24-meses': 'contraditorio' }
    expect(situacaoFinal(r.itens, conferidos, 'insuficiente')).toBe('contraditorio')
    expect(motivoParaNaoRegistrar({ itens: r.itens, conferidos, decisao: 'suficiente', abordar: '', semRoteiro: false, conferenciaManual: '' })).toBe(
      'Há contradição conferida: o parecer fica Contraditório e o caso não avança (G18).',
    )
    // A advogada corrige: não havia contradição.
    expect(situacaoFinal(r.itens, { ...conferidos, 'menos-de-24-meses': 'ausente' }, 'suficiente')).toBe('suficiente')
  })

  it('GGVP-93 CA3 · sem roteiro, a conferência manual é obrigatória', () => {
    const base = { itens: [], conferidos: {}, decisao: 'suficiente' as const, abordar: '', semRoteiro: true, conferenciaManual: 'curto' }
    expect(motivoParaNaoRegistrar(base)).toBe('O benefício não tem roteiro: escreva o que você conferiu nos documentos (conferência manual).')
    expect(motivoParaNaoRegistrar({ ...base, conferenciaManual: 'Li os três laudos e conferi as datas.' })).toBeNull()
  })

  it('GGVP-29 CA1 e CA2 · a orientação ao médico: as perguntas do que falta, sem as frases-chave do roteiro nem CID', () => {
    const loas = emVigor(roteirosDeExemplo()[0])
    const r = analisar(loas.itens, [leitura('laudo', '2026-08-20', ['natureza', 'inicio', 'limitacoes'])])
    const abordar = abordarSugerido(r.itens, [])
    const orientacao = orientacaoAoMedico({ nome: 'Rita Exemplo', beneficio: 'LOAS Deficiente', abordar })
    expect(orientacao).toContain('Orientação para o médico de Rita Exemplo')
    expect(orientacao).toContain('• Qual a previsão de duração do quadro?')
    expect(orientacao).toContain('• O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?')
    // As frases-chave (o texto dos itens) não vão para o médico copiar.
    for (const item of loas.itens) expect(orientacao).not.toContain(item.texto)
    expect(problemaG20(abordar)).toBeNull()
  })

  it('GGVP-29 · a mensagem pronta do Chatwoot leva as perguntas e até quando, e passa no G20', () => {
    const mensagem = mensagemDoComplemento({
      nome: 'Rita Exemplo',
      beneficio: 'LOAS Deficiente',
      perguntas: ['Qual a previsão de duração do quadro?'],
      ate: '2026-10-09',
      hoje: '2026-10-06',
    })
    expect(mensagem).toBe(
      'Olá, Rita! Aqui é do escritório GGV. Para o seu caso de LOAS Deficiente, precisamos de um relatório médico novo. Leve ao seu médico estas perguntas, para ele responder no relatório:\n1. Qual a previsão de duração do quadro?\nQuando tiver o relatório, mande foto por aqui ou traga ao escritório até 09/10. Qualquer dúvida, é só responder esta mensagem.',
    )
    expect(problemaG20(mensagem)).toBeNull()
  })

  it('GGVP-33 CA2 · a dispensa pede justificativa e duas sêniores: quem pediu não aprova', () => {
    expect(motivoParaNaoPedirDispensa('curta')).toMatch(/justificativa é obrigatória/)
    expect(motivoParaNaoPedirDispensa('Prazo do juiz vence amanhã e o médico só atende em novembro.')).toBeNull()
    const pedido = { justificativa: 'prazo do juiz', pedidaPor: 'Dra. Renata (exemplo)', pedidaEm: '2026-10-06T15:00:00.000Z' }
    expect(motivoParaNaoAprovarDispensa(pedido, 'Dra. Renata (exemplo)')).toBe('Uma pessoa sozinha não dispensa o parecer: a segunda aprovação é de outra sênior (G17).')
    expect(motivoParaNaoAprovarDispensa(pedido, 'Dr. Otávio (exemplo)')).toBeNull()
    expect(motivoParaNaoAprovarDispensa({ ...pedido, aprovadaPor: 'Dr. Otávio (exemplo)' }, 'Dra. Clara')).toBe('O pedido de dispensa já foi respondido.')
    expect(motivoParaNaoAprovarDispensa(undefined, 'Dr. Otávio (exemplo)')).toBe('Não há pedido de dispensa.')
  })

  it('GGVP-33 CA3 · o chat recusa pular o parecer e diz o portão; outro pedido passa', () => {
    for (const pedido of ['pula o parecer da Rita', 'Libera o caso da Rita sem o parecer', 'dispensar parecer do Antônio', 'segue sem parecer mesmo']) {
      expect(recusaDoChat(pedido), pedido).toMatch(/^Não posso pular o parecer médico\..*\(G17\)/)
    }
    expect(recusaDoChat('Resumo do caso da Rita')).toBeNull()
    expect(recusaDoChat('qual o parecer da Rita?')).toBeNull()
  })
})
