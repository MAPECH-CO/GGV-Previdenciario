import { beforeEach, describe, expect, it } from 'vitest'
import { eventosDaAgenda, tarefasDeConfirmar } from './agenda.ts'
import { enviarArquivos } from './documentos.ts'
import {
  abordarSugeridoNaPericia,
  adiarCobrancaDaPericia,
  autorizarRemarcacao,
  concluirDocumentos,
  decidirFaltaDaPericia,
  esperarComprovante,
  etapaDaPericia,
  iniciarPericia,
  justificarFalta,
  lerComprovante,
  liberarAgendamento,
  obterCobrancaDaPericia,
  obterLembrete,
  obterPericia,
  pedirAoMedicoNaPericia,
  registrarCobrancaDaPericia,
  registrarLembrete,
  registrarMarcacao,
  registrarTentativa,
  remarcarPericia,
  tarefasDaAdvogadaNaPericia,
  tarefasDaDocumentacaoNaPericia,
  tarefasDeDecidirDocumentoDaPericia,
  tarefasDoJuridicoAdm,
} from './pericia.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 7, 10, 0)

beforeEach(() => {
  agora = new Date(2026, 9, 7, 10, 0)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

const IGOR = 'Igor (exemplo)'
const linhas = () => tarefasDoJuridicoAdm().map((t) => `${t.cliente?.nome} · ${t.acao}`)

/** O Igor sobe o comprovante da Maria, confere a leitura e registra. */
async function marcarMaria(pedeDocumentoNovo = false, nome = 'comprovante_maria.pdf') {
  const lido = await lerComprovante('maria-exemplo-1', nome)
  return registrarMarcacao('maria-exemplo-1', { comprovante: { nome }, lido, pedeDocumentoNovo }, IGOR)
}

describe('GGVP-49 · iniciar a tarefa de perícia', () => {
  it('CA1 · o sistema abre a tarefa para o Jurídico administrativo e o caso mostra "Em perícia" com a origem', async () => {
    const p = await iniciarPericia('cleide-exemplo-1', {
      origem: 'd3-despacho',
      tipo: 'medica',
      instancia: 'juizo',
      pedidaPor: 'Dra. Renata (exemplo)',
    })
    expect(p).toMatchObject({ processoId: 'cleide-exemplo-1', fichaId: 'cleide-exemplo', tipo: 'medica', instancia: 'juizo' })
    expect(etapaDaPericia('cleide-exemplo-1')).toBe('Em perícia · despacho da sênior (D3) · perícia médica')
    expect(linhas()).toContain('Cleide Exemplo · Marcar perícia')
  })

  it('CA2 · no D2 a tarefa só aparece quando o INSS libera o agendamento, com o título "<nome> · Marcar perícia"', async () => {
    await iniciarPericia('rita-exemplo-1', { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: 'Dra. Paula (exemplo)' })
    expect((await obterPericia('rita-exemplo-1'))?.situacao).toBe('aguardando-inss')
    expect(tarefasDoJuridicoAdm().some((t) => t.cliente?.id === 'rita-exemplo')).toBe(false)

    agora = new Date(2026, 9, 8, 9, 0)
    await liberarAgendamento('rita-exemplo-1')
    const tarefa = tarefasDoJuridicoAdm().find((t) => t.cliente?.id === 'rita-exemplo')!
    expect(tarefa).toMatchObject({ codigo: 'DP.02', acao: 'Marcar perícia', prazo: 'hoje', href: '/casos/rita-exemplo-1/pericia/marcar' })
  })

  it('CA2 · na semente, a Maria (pedida ontem, liberada hoje) está na Central para marcar', () => {
    expect(linhas()).toEqual(['Maria Exemplo · Marcar perícia'])
    const maria = tarefasDoJuridicoAdm().find((t) => t.cliente?.id === 'maria-exemplo')!
    expect(maria.detalhe).toBe('Auxílio por Incapacidade Temporária · perícia médica · o INSS já liberou o agendamento · no Meu INSS (senha no cofre); subir o comprovante')
  })

  it('CA3 · a tarefa vem preenchida: quem pediu, tipo, instância e o que a perícia pede', async () => {
    const pedro = (await obterPericia('pedro-exemplo-1'))!
    expect(pedro.pericia).toMatchObject({
      origem: 'd2-exigencia',
      pedidaPor: 'Dra. Paula (exemplo)',
      tipo: 'social',
      instancia: 'inss',
      oQuePede: 'avaliação social pedida pelo INSS na exigência: visita à casa e composição do grupo familiar',
    })
    expect(pedro.beneficio).toBe('LOAS Idoso')
  })

  it('CA4 · o histórico diz que foi o sistema que abriu, quando, e a decisão de quem', async () => {
    const maria = (await obterPericia('maria-exemplo-1'))!
    const [pedido, aberta, liberada] = maria.pericia.historico
    expect(pedido).toMatchObject({ quem: 'Dra. Paula (exemplo)', passo: 'D2.03', oQue: 'Pediu a perícia médica (D2 · necessidade inicial)' })
    expect(aberta).toMatchObject({
      quem: 'Sistema',
      passo: 'DP.01',
      oQue: 'Abriu a tarefa de perícia para o Jurídico administrativo, a partir da decisão de Dra. Paula (exemplo) (D2 · necessidade inicial)',
    })
    expect(new Date(aberta.quando)).toEqual(new Date(2026, 9, 6, 16, 10))
    expect(liberada).toMatchObject({ quem: 'Sistema', passo: 'D2.E1' })
    expect(new Date(liberada.quando)).toEqual(new Date(2026, 9, 7, 8, 0))
  })
})

describe('GGVP-53 · marcar a perícia com o cliente', () => {
  it('CA1 · a tentativa sem sucesso fica com o dia e o que aconteceu; a tarefa continua e volta amanhã', async () => {
    await expect(registrarTentativa('maria-exemplo-1', { dia: '2026-10-07', oQueAconteceu: '' }, IGOR)).rejects.toThrow('Diga o que aconteceu na tentativa.')
    const t = await registrarTentativa('maria-exemplo-1', { dia: '2026-10-07', oQueAconteceu: 'Meu INSS sem vaga na agência próxima' }, IGOR)
    expect(t.pericia.tentativas).toMatchObject([{ dia: '2026-10-07', oQueAconteceu: 'Meu INSS sem vaga na agência próxima', quem: IGOR }])
    expect(t.pericia.historico.at(-1)).toMatchObject({ quem: IGOR, passo: 'DP.02', oQue: 'Tentativa sem sucesso em 07/10: Meu INSS sem vaga na agência próxima' })
    expect(tarefasDoJuridicoAdm().find((x) => x.cliente?.id === 'maria-exemplo')).toMatchObject({ acao: 'Marcar perícia', prazo: 'amanhã' })
  })

  it('CA2, CA3 · o comprovante é lido (data, hora, local e tipo; sem perito) e vai para a pasta, a agenda e a ficha', async () => {
    const lido = await lerComprovante('maria-exemplo-1', 'comprovante_maria.pdf')
    expect(lido).toEqual({ data: '2026-10-21', hora: '08:30', local: 'Agência INSS Santo Amaro (exemplo)', modalidade: 'presencial', tipo: 'medica' })
    expect(Object.keys(lido)).not.toContain('perito')
    // A data que o nome do arquivo traz vale.
    expect((await lerComprovante('maria-exemplo-1', 'comprovante 2026-10-26.pdf')).data).toBe('2026-10-26')

    const t = await marcarMaria()
    expect(t.situacao).toBe('agendada')
    expect(t.pericia.lembrete).toEqual({ para: '2026-10-20' })
    expect(etapaDaPericia('maria-exemplo-1')).toBe('Em perícia · pedido ao INSS (D2) · perícia médica em 21/10, 08:30')
    expect((await obterFicha('maria-exemplo'))!.arquivos.at(-1)).toMatchObject({ nome: 'comprovante_maria.pdf', tipo: 'comprovante-pericia', local: 'maria-exemplo-1' })
    const evento = (await eventosDaAgenda('2026-10-21', '2026-10-21')).find((e) => e.categoria === 'pericias')!
    expect(evento).toMatchObject({ titulo: 'Maria Exemplo', oQue: 'Perícia médica', hora: '08:30', passo: 'DP.02 · Marcar a perícia no INSS', processoId: 'maria-exemplo-1' })
    expect(t.pericia.historico.slice(-4).map((e) => e.oQue)).toEqual([
      'Marcou a perícia médica no Meu INSS e subiu o comprovante (comprovante_maria.pdf)',
      'Leu o comprovante (21/10, 08:30, Agência INSS Santo Amaro (exemplo)) e pôs na agenda e na ficha',
      'Agendou o lembrete da véspera para 20/10',
      'A perícia não pede documento novo: segue para ligar e orientar (DP.06)',
    ])
    expect(linhas()).not.toContain('Maria Exemplo · Marcar perícia')
  })

  it('CA3, CA4 · sem a resposta do documento novo ou com data passada, o servidor recusa; "Sim" atribui à Documentação', async () => {
    const lido = await lerComprovante('maria-exemplo-1', 'c.pdf')
    await expect(registrarMarcacao('maria-exemplo-1', { comprovante: { nome: 'c.pdf' }, lido: { ...lido, data: '2026-10-01' }, pedeDocumentoNovo: false }, IGOR)).rejects.toThrow(
      'Confira a data da perícia: ela não pode ser passada.',
    )
    const t = await marcarMaria(true)
    expect(t.pericia.pedeDocumentoNovo).toBe(true)
    expect(t.pericia.historico.at(-1)!.oQue).toBe('A perícia pede documento novo: atribuiu à Documentação (DP.03)')
  })

  it('CA6 · marcada sem o comprovante: a tarefa espera com lembrete diário e retoma quando ele sobe', async () => {
    const t = await esperarComprovante('maria-exemplo-1', { pedeDocumentoNovo: false }, IGOR)
    expect(t.situacao).toBe('aguardando-comprovante')
    expect(tarefasDoJuridicoAdm().find((x) => x.cliente?.id === 'maria-exemplo')).toMatchObject({ acao: 'Subir o comprovante do INSS', prazo: 'amanhã' })
    agora = new Date(2026, 9, 9, 9, 0)
    expect(tarefasDoJuridicoAdm().find((x) => x.cliente?.id === 'maria-exemplo')).toMatchObject({ prazo: 'atrasada desde 08/10', urgente: true })
    expect((await marcarMaria()).situacao).toBe('agendada')
  })

  it('CA7 · na véspera, o Jurídico confere e envia o lembrete com data, hora, local e o que levar', async () => {
    await marcarMaria()
    expect(linhas()).not.toContain('Maria Exemplo · Enviar o lembrete da véspera')
    agora = new Date(2026, 9, 20, 9, 0)
    expect(linhas()).toContain('Maria Exemplo · Enviar o lembrete da véspera')
    const { mensagem } = await obterLembrete('maria-exemplo-1')
    expect(mensagem).toContain('a sua perícia médica é amanhã, quarta, 21/10, às 08:30. O local é Agência INSS Santo Amaro (exemplo).')
    expect(mensagem).toContain('Leve documento com foto')
    const t = await registrarLembrete('maria-exemplo-1', mensagem, IGOR)
    expect(t.pericia.lembrete).toMatchObject({ para: '2026-10-20', por: IGOR, mensagem })
    expect(linhas()).not.toContain('Maria Exemplo · Enviar o lembrete da véspera')
  })

  it('CA8 · remarcada, o novo comprovante reprograma o lembrete e a troca fica no histórico', async () => {
    await marcarMaria()
    await remarcarPericia('maria-exemplo-1', 'cliente internada no dia', IGOR)
    expect(linhas()).toContain('Maria Exemplo · Remarcar perícia')
    const t = await marcarMaria(false, 'comprovante novo.pdf')
    expect(t.pericia.marcacao!.data).toBe('2026-10-28')
    expect(t.pericia.lembrete).toEqual({ para: '2026-10-27' })
    expect(t.pericia.historico.map((e) => e.oQue)).toContain('Data trocada: 21/10, 08:30 → 28/10, 08:30; lembrete reprogramado para 27/10')
  })

  it('CA9 · passou de 2 remarcações: sobe para a advogada responsável, nunca a sênior; ela autoriza mais uma', async () => {
    for (const motivo of ['cliente doente', 'agência fechada', 'cliente viajou']) {
      await marcarMaria()
      await remarcarPericia('maria-exemplo-1', motivo, IGOR)
    }
    const t = (await obterPericia('maria-exemplo-1'))!
    expect(t.situacao).toBe('na-advogada')
    expect(t.pericia.historico.at(-1)!.oQue).toBe('Passou do limite de 2 remarcações: a perícia subiu para a advogada responsável (G15)')
    expect(linhas()).not.toContain('Maria Exemplo · Remarcar perícia')
    expect(tarefasDaAdvogadaNaPericia()).toMatchObject([
      { codigo: 'DP.02', acao: 'Decidir a perícia', cliente: { id: 'maria-exemplo' }, href: '/casos/maria-exemplo-1/pericia', urgente: true },
    ])
    await expect(autorizarRemarcacao('maria-exemplo-1', 'curta', 'Dra. Paula (exemplo)')).rejects.toThrow('Escreva a justificativa')
    await autorizarRemarcacao('maria-exemplo-1', 'Cliente internada; o médico dá alta na semana que vem.', 'Dra. Paula (exemplo)')
    expect(tarefasDaAdvogadaNaPericia()).toEqual([])
    expect(linhas()).toContain('Maria Exemplo · Remarcar perícia')
  })

  it('judicial (Lucas, 02/10) · a data do juízo é lida da publicação e posta na agenda sozinha', async () => {
    const antonio = (await obterPericia('antonio-exemplo-1'))!
    expect(antonio.situacao).toBe('agendada')
    expect(antonio.pericia.marcacao).toMatchObject({ data: '2026-10-16', hora: '10:30', origem: 'juizo', registradaPor: 'Sistema' })
    expect(antonio.pericia.historico.map((e) => e.oQue)).toContain(
      'Leu a data na publicação e pôs na agenda e na ficha: 16/10, 10:30, Vara Federal de Santo Amaro (exemplo) · sala de perícias',
    )
    const evento = (await eventosDaAgenda('2026-10-16', '2026-10-16')).find((e) => e.categoria === 'pericias')!
    expect(evento.passo).toBe('DP.04 · Data do juízo, lida da publicação')
  })

  it('a perícia que passou não vira "confirmar entrevista" no Atendimento: o comparecimento é do Jurídico administrativo', async () => {
    agora = new Date(2026, 9, 20, 9, 0)
    expect(tarefasDeConfirmar().some((t) => t.cliente?.id === 'antonio-exemplo')).toBe(false)
  })
})

const arquivo = (nome: string, tipo: string, n: number) => ({ nome, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(n).padStart(64, '0') })

describe('GGVP-56 · reunir o que a perícia pede', () => {
  it('CA3 · "Não" no documento novo: a tarefa da Documentação não nasce', async () => {
    await marcarMaria(false)
    expect(tarefasDaDocumentacaoNaPericia().some((t) => t.cliente?.id === 'maria-exemplo')).toBe(false)
    expect((await obterPericia('maria-exemplo-1'))!.documentos).toBeUndefined()
  })

  it('CA1 · perícia médica com "Sim": a lista de laudos e exames, até 10 dias antes', async () => {
    await marcarMaria(true)
    const t = (await obterPericia('maria-exemplo-1'))!
    expect(t.documentos!.itens.map((i) => i.item.nome)).toEqual(['Laudo médico recente (até 30 dias)', 'Exames', 'Receitas', 'Atestados de afastamento'])
    expect(tarefasDaDocumentacaoNaPericia().find((x) => x.cliente?.id === 'maria-exemplo')).toMatchObject({
      codigo: 'DP.03',
      acao: 'Reunir documentos da perícia',
      prazo: 'até 11/10',
      href: '/casos/maria-exemplo-1/pericia/documentos',
    })
  })

  it('CA2 · avaliação social: CadÚnico, grupo familiar e as declarações; a Documentação reúne e cobra', () => {
    const doPedro = tarefasDaDocumentacaoNaPericia().filter((t) => t.cliente?.id === 'pedro-exemplo')
    expect(doPedro.map((t) => t.acao)).toEqual(['Reunir documentos da perícia', 'Cobrar documento da perícia'])
    expect(doPedro[0].detalhe).toBe('LOAS Idoso · avaliação social em 23/10 · faltam 4')
    expect(doPedro[1].detalhe).toContain('cadúnico atualizado, composição do grupo familiar, declaração de moradia')
  })

  it('CA4 · o que chega pela pasta segue a leitura da IA do D1 e conta como anexado', async () => {
    await enviarArquivos('pedro-exemplo', { origem: 'card', arquivos: [arquivo('cadunico pedro.pdf', 'cadunico', 1)] })
    const t = (await obterPericia('pedro-exemplo-1'))!
    expect(t.documentos!.itens.find((i) => i.item.id === 'cadunico')!.arquivo).toMatchObject({ nome: 'cadunico pedro.pdf', aguardaLeitura: true })
    expect(t.documentos!.faltando.map((i) => i.id)).toEqual(['grupo-familiar', 'moradia', 'uniao-separacao'])
  })

  it('CA5, CA6 · concluir pede o pendente resolvido e as conferências; grava quem e quando e volta ao Jurídico administrativo', async () => {
    const DOC = 'Jéssica (exemplo)'
    const todas = ['cadunico', 'grupo-familiar', 'leitura']
    await expect(concluirDocumentos('pedro-exemplo-1', { conferidas: todas }, DOC)).rejects.toThrow('Faltam 4 itens')
    await enviarArquivos('pedro-exemplo', { origem: 'card', arquivos: [arquivo('cadunico.pdf', 'cadunico', 2), arquivo('grupo familiar.pdf', 'grupo-familiar', 3)] })
    await expect(justificarFalta('pedro-exemplo-1', 'moradia', 'oi', DOC)).rejects.toThrow('Diga por que o documento falta.')
    await justificarFalta('pedro-exemplo-1', 'moradia', 'mora em casa própria, com escritura na pasta', DOC)
    await justificarFalta('pedro-exemplo-1', 'uniao-separacao', 'não se aplica: viúvo', DOC)
    await expect(concluirDocumentos('pedro-exemplo-1', { conferidas: ['leitura'] }, DOC)).rejects.toThrow('Marque as conferências.')
    const t = await concluirDocumentos('pedro-exemplo-1', { conferidas: todas }, DOC)
    expect(t.pericia.documentos!.concluida).toMatchObject({ quem: DOC, conferidas: todas })
    expect(t.pericia.historico.slice(-2).map((e) => e.oQue)).toEqual([
      'Concluiu os documentos da perícia: 2 anexados, 2 com a falta justificada',
      'O fluxo voltou ao Jurídico administrativo: ligar e orientar o cliente (DP.06)',
    ])
    expect(tarefasDaDocumentacaoNaPericia().some((x) => x.cliente?.id === 'pedro-exemplo')).toBe(false)
  })

  it('CA6 · sem o comprovante ainda, a conclusão volta ao Jurídico administrativo para subir o comprovante', async () => {
    await esperarComprovante('maria-exemplo-1', { pedeDocumentoNovo: true }, IGOR)
    expect(tarefasDaDocumentacaoNaPericia().find((x) => x.cliente?.id === 'maria-exemplo')?.prazo).toBe('sem data ainda')
    for (const item of ['laudo-recente', 'exames', 'receitas', 'atestados']) await justificarFalta('maria-exemplo-1', item, 'o médico só atende no fim do mês', 'Jéssica (exemplo)')
    const t = await concluirDocumentos('maria-exemplo-1', { conferidas: ['laudos-exames', 'leitura'] }, 'Jéssica (exemplo)')
    expect(t.pericia.historico.at(-1)!.oQue).toBe('O fluxo voltou ao Jurídico administrativo: subir o comprovante do INSS (DP.02)')
  })

  it('CA7 · o pedido ao médico lista o que abordar, com as perguntas do roteiro; o servidor recusa diagnóstico e CID (G20)', async () => {
    await marcarMaria(true)
    const sugerido = await abordarSugeridoNaPericia('maria-exemplo-1')
    expect(sugerido.startsWith('O relatório médico precisa responder:\n• ')).toBe(true)
    await expect(pedirAoMedicoNaPericia('maria-exemplo-1', 'Escreva que a paciente tem CID M54.5', 'Jéssica (exemplo)')).rejects.toThrow('G20')
    await expect(pedirAoMedicoNaPericia('maria-exemplo-1', 'Confirme o diagnóstico de lombalgia', 'Jéssica (exemplo)')).rejects.toThrow('G20')
    const t = await pedirAoMedicoNaPericia('maria-exemplo-1', sugerido, 'Jéssica (exemplo)')
    expect(t.pericia.documentos!.pedidosAoMedico).toMatchObject([{ abordar: sugerido }])
    const { mensagem } = await obterCobrancaDaPericia('maria-exemplo-1')
    expect(mensagem).toContain('ainda precisamos de: laudo médico recente (até 30 dias); exames; receitas; atestados de afastamento.')
    expect(mensagem).toContain(`Para o laudo, leve ao seu médico este pedido; ele responde com as palavras dele:\n${sugerido}`)
  })

  it('Lucas, 02/10 · a cobrança é diária e, passados os 10 dias antes, sobe para a advogada responsável (G15)', async () => {
    const { mensagem } = await obterCobrancaDaPericia('pedro-exemplo-1')
    await registrarCobrancaDaPericia('pedro-exemplo-1', mensagem, 'Jéssica (exemplo)')
    expect(tarefasDaDocumentacaoNaPericia().filter((t) => t.cliente?.id === 'pedro-exemplo').map((t) => t.acao)).toEqual(['Reunir documentos da perícia'])
    agora = new Date(2026, 9, 8, 9, 0)
    expect(tarefasDaDocumentacaoNaPericia().filter((t) => t.cliente?.id === 'pedro-exemplo').map((t) => t.acao)).toContain('Cobrar documento da perícia')
    await adiarCobrancaDaPericia('pedro-exemplo-1', 'Jéssica (exemplo)')
    expect(tarefasDaDocumentacaoNaPericia().filter((t) => t.cliente?.id === 'pedro-exemplo').map((t) => t.acao)).not.toContain('Cobrar documento da perícia')

    agora = new Date(2026, 9, 14, 9, 0)
    expect(tarefasDaDocumentacaoNaPericia().filter((t) => t.cliente?.id === 'pedro-exemplo').map((t) => t.acao)).toEqual(['Reunir documentos da perícia'])
    expect(tarefasDeDecidirDocumentoDaPericia()).toMatchObject([{ acao: 'Decidir documento da perícia', cliente: { id: 'pedro-exemplo' }, href: '/casos/pedro-exemplo-1/pericia' }])
    await decidirFaltaDaPericia('pedro-exemplo-1', 'Seguir sem a declaração; a visita confere a moradia.', 'Dra. Paula (exemplo)')
    expect(tarefasDeDecidirDocumentoDaPericia()).toEqual([])
  })
})
