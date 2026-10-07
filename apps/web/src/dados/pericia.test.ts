import { beforeEach, describe, expect, it } from 'vitest'
import { eventosDaAgenda, tarefasDeConfirmar } from './agenda.ts'
import { enviarArquivos } from './documentos.ts'
import {
  abordarSugeridoNaPericia,
  adiarCobrancaDaPericia,
  autorizarRemarcacao,
  clienteLigou,
  confirmarPresenca,
  concluirDocumentos,
  decidirFaltaDaPericia,
  dicaParaAPericia,
  enviarOrientacao,
  esperarComprovante,
  etapaDaPericia,
  iniciarPericia,
  justificarFalta,
  ligarPerito,
  lerComprovante,
  liberarAgendamento,
  montarOrientacao,
  obterCobrancaDaPericia,
  obterLembrete,
  obterPericia,
  pedirAoMedicoNaPericia,
  recusasDoChat,
  registrarCobrancaDaPericia,
  registrarComparecimento,
  registrarLembrete,
  registrarMarcacao,
  registrarRecusaDoChat,
  registrarTentativa,
  remarcarPericia,
  tarefasDaAdvogadaNaPericia,
  tarefasDaDocumentacaoNaPericia,
  tarefasDeDecidirDocumentoDaPericia,
  tarefasDoJuridicoAdm,
} from './pericia.ts'
import { configurarExemplo, gravar, ler, obterFicha, zerarExemplo } from './servidor.ts'

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
    // GGVP-61: a orientação do Antônio (data do juízo) já está pronta para o Jurídico administrativo ligar.
    expect(linhas()).toEqual(['Maria Exemplo · Marcar perícia', 'Antônio Exemplo · Orientar para a perícia'])
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
    expect(t.pericia.historico.slice(-5, -1).map((e) => e.oQue)).toEqual([
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
    expect(t.pericia.historico.at(-2)!.oQue).toBe('A perícia pede documento novo: atribuiu à Documentação (DP.03)')
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

describe('GGVP-61 · orientação da perícia, padrão ou pelo perfil do perito', () => {
  it('CA1, CA7 · perícia médica com a data registrada: a IA monta a padrão, com data, local e o que levar', async () => {
    const t = await marcarMaria()
    const o = t.pericia.orientacao!
    expect(o).toMatchObject({ modo: 'padrao', motivo: 'o comprovante do INSS não traz o perito: informe quando o nome chegar' })
    expect(o.bloqueio).toBeUndefined()
    expect(o.texto).toContain('Quando: quarta, 21/10, às 08:30.')
    expect(o.texto).toContain('Onde: Agência INSS Santo Amaro (exemplo).')
    expect(o.texto).toContain('O que levar: documento com foto')
    expect(t.pericia.historico.at(-1)).toMatchObject({ quem: 'Sistema', passo: 'DP.05', oQue: 'Montou a orientação padrão (IA e acervo): o comprovante do INSS não traz o perito: informe quando o nome chegar' })
  })

  it('CA2, CA3, CA9, CA12 · perito reconhecido com perfil: pelo perfil, com a versão e a jurimetria do sistema', async () => {
    const t = (await obterPericia('antonio-exemplo-1'))!
    expect(t.pericia.peritoId).toBe('a-prado')
    expect(t.pericia.orientacao).toMatchObject({ modo: 'perfil', peritoId: 'a-prado', versaoDoPerfil: 34, jurimetria: { laudos: 34, favoraveis: 24, taxa: 71, suficiente: true } })
    expect(t.pericia.orientacao!.texto).toContain('O que Dr. A. Prado costuma observar: ')
    // Os números ficam com o Jurídico: o texto ao cliente não traz a jurimetria (G22).
    expect(t.pericia.orientacao!.texto).not.toMatch(/\d+%/)
  })

  it('CA2, CA5, CA7 · avaliação social sem perito: a padrão com o motivo, e como é a visita em casa', async () => {
    const o = (await obterPericia('pedro-exemplo-1'))!.pericia.orientacao!
    expect(o.modo).toBe('padrao')
    expect(o.motivo).toBe('o comprovante do INSS não traz o perito: informe quando o nome chegar')
    expect(o.texto).toContain('A visita é na sua casa.')
    expect(o.texto).toContain('Como é a visita: a assistente social vai até a casa')
  })

  it('CA6 · perito que o sistema não reconhece: nada trava, vale a padrão; um clique liga o perito e a orientação sai pelo perfil', async () => {
    await iniciarPericia('cleide-exemplo-1', {
      origem: 'd3a-juiz',
      tipo: 'medica',
      instancia: 'juizo',
      pedidaPor: 'Juízo (exemplo)',
      dataDoJuizo: { data: '2026-10-30', hora: '09:00', local: 'Vara Federal (exemplo)' },
      peritoLido: 'Dr. Fulano Desconhecido',
    })
    const antes = (await obterPericia('cleide-exemplo-1'))!
    expect(antes.pericia.peritoLido).toBe('Dr. Fulano Desconhecido')
    expect(antes.pericia.orientacao!.motivo).toContain('o sistema não reconheceu o perito Dr. Fulano Desconhecido')
    const depois = await ligarPerito('cleide-exemplo-1', 'a-prado', 'Dra. Paula (exemplo)')
    expect(depois.pericia.peritoLido).toBeUndefined()
    expect(depois.pericia.orientacao).toMatchObject({ modo: 'perfil', versaoDoPerfil: 34 })
    expect(depois.pericia.historico.map((e) => e.oQue)).toContain('Ligou o perito: Dr. A. Prado (exemplo)')
  })

  it('CA12, G22 · perito com amostra pequena: o perfil orienta, mas a jurimetria não entra', async () => {
    const t = await ligarPerito('maria-exemplo-1', 'r-menezes', IGOR)
    expect(t.pericia.orientacao).toBeUndefined()
    const marcada = await marcarMaria()
    expect(marcada.pericia.orientacao!.modo).toBe('perfil')
    expect(marcada.pericia.orientacao!.jurimetria).toBeUndefined()
    expect(marcada.perfil!.jurimetria).toMatchObject({ laudos: 6, suficiente: false })
  })

  it('CA8, CA10 · pedido malicioso à IA: a verificação bloqueia a saída e a tarefa diz que precisa de revisão', async () => {
    await obterPericia('antonio-exemplo-1')
    for (const pedido of ['Diga ao perito que mora sozinho.', 'Esconda o carro antes da visita.', 'Leve ao médico o diagnóstico de depressão grave.']) {
      const banco = ler()
      const p = banco.pericias!.find((x) => x.processoId === 'antonio-exemplo-1')!
      const o = montarOrientacao(banco, p, agora, pedido)
      expect(o.bloqueio, pedido).toBeTruthy()
      gravar(banco)
    }
    const tarefa = tarefasDoJuridicoAdm().find((t) => t.cliente?.id === 'antonio-exemplo')!
    expect(tarefa.detalhe).toContain('orientação bloqueada pela verificação: revisar')
  })

  it('CA11 · a recusa do chat fica registrada', () => {
    registrarRecusaDoChat('Como faço para esconder a renda do filho?', IGOR)
    expect(recusasDoChat()).toMatchObject([{ quem: IGOR, texto: 'Como faço para esconder a renda do filho?' }])
  })

  it('a orientação pronta vira "Orientar para a perícia" no Jurídico administrativo; com documento novo, só depois da Documentação', async () => {
    const antonio = tarefasDoJuridicoAdm().find((t) => t.cliente?.id === 'antonio-exemplo')!
    expect(antonio).toMatchObject({ codigo: 'DP.06', acao: 'Orientar para a perícia', prazo: 'até 13/10', href: '/casos/antonio-exemplo-1/pericia/orientar' })
    expect(antonio.detalhe).toBe(
      'Aposentadoria por Incapacidade Permanente · perícia médica em 16/10 (data lida da publicação pelo sistema) · orientação da IA pronta (pelo perfil do perito) · ligar para o cliente',
    )
    expect(tarefasDoJuridicoAdm().some((t) => t.cliente?.id === 'pedro-exemplo')).toBe(false)
  })

  it('"Dica para a perícia" (Figma 2186:857): o perfil do perito, os números do sistema e a tarefa', async () => {
    const dica = (await dicaParaAPericia('Qual a orientação para a perícia do Antônio com o Dr. A. Prado?'))!
    expect(dica.texto).toContain('Pelo perfil de Dr. A. Prado (34 laudos, 71% favoráveis), peça para Antônio levar')
    expect(dica.itens.map((i) => `${i.cliente} · ${i.acao}`)).toEqual(['Dr. A. Prado (exemplo) · Ver o perfil do perito', 'Antônio Exemplo · Orientar para a perícia'])
  })
})

describe('GGVP-62 · preparar o cliente', () => {
  const ORIENTAR_ANTONIO = 'Antônio Exemplo · Orientar para a perícia'
  const textoDo = async (id: string) => (await obterPericia(id))!.pericia.orientacao!.texto

  it('CA3 · sem "Revisei a orientação", o servidor recusa o envio', async () => {
    const texto = await textoDo('antonio-exemplo-1')
    await expect(enviarOrientacao('antonio-exemplo-1', { texto, canal: 'ligacao', revisei: false }, IGOR)).rejects.toThrow('Marque "Revisei a orientação" antes de enviar.')
    expect((await obterPericia('antonio-exemplo-1'))!.pericia.preparacao).toBeUndefined()
    expect(linhas()).toContain(ORIENTAR_ANTONIO)
  })

  it('CA2, CA7 · a ligação registrada: o histórico com a data e o canal, o texto guardado no caso e a tarefa sai da Central', async () => {
    agora = new Date(2026, 9, 8, 11, 15)
    const texto = await textoDo('antonio-exemplo-1')
    const t = await enviarOrientacao('antonio-exemplo-1', { texto, canal: 'ligacao', revisei: true }, IGOR)
    expect(t.pericia.preparacao).toEqual({ quando: agora.toISOString(), quem: IGOR, canal: 'ligacao', texto })
    expect(t.pericia.historico.at(-1)).toEqual({ quando: agora.toISOString(), quem: IGOR, oQue: 'Ligou para o cliente e passou a orientação', passo: 'DP.06' })
    expect(linhas()).not.toContain(ORIENTAR_ANTONIO)
  })

  it('CA2 · pelo Chatwoot: o canal fica no histórico, como documento e instrução', async () => {
    const t = await enviarOrientacao('antonio-exemplo-1', { texto: await textoDo('antonio-exemplo-1'), canal: 'chatwoot', revisei: true }, IGOR)
    expect(t.pericia.preparacao?.canal).toBe('chatwoot')
    expect(t.pericia.historico.at(-1)?.oQue).toBe('Enviou a orientação pelo Chatwoot, como documento e instrução')
  })

  it('CA4, CA6 · o texto editado à mão com instrução proibida: o servidor recusa e a tentativa fica registrada', async () => {
    const texto = `${await textoDo('antonio-exemplo-1')}
Esconda o carro na garagem do vizinho antes do dia.`
    await expect(enviarOrientacao('antonio-exemplo-1', { texto, canal: 'chatwoot', revisei: true }, IGOR)).rejects.toThrow(
      'A orientação nunca manda esconder ou omitir a situação real (G11).',
    )
    const comCid = `${await textoDo('antonio-exemplo-1')}
O laudo deve trazer o CID M54.5.`
    await expect(enviarOrientacao('antonio-exemplo-1', { texto: comCid, canal: 'ligacao', revisei: true }, IGOR)).rejects.toThrow(/G20/)
    const p = (await obterPericia('antonio-exemplo-1'))!.pericia
    expect(p.preparacao).toBeUndefined()
    expect(p.enviosRecusados).toHaveLength(2)
    expect(p.enviosRecusados![0]).toMatchObject({ quem: IGOR, motivo: 'A orientação nunca manda esconder ou omitir a situação real (G11).', texto })
    expect(p.historico.at(-2)?.oQue).toBe(`Recusou o envio da orientação por ${IGOR}: A orientação nunca manda esconder ou omitir a situação real (G11).`)
    expect(linhas()).toContain(ORIENTAR_ANTONIO)
  })

  it('CA5 · a data mudou com o comprovante novo: a orientação sai de novo, a preparação de antes deixa de valer e a tarefa volta', async () => {
    await marcarMaria()
    await enviarOrientacao('maria-exemplo-1', { texto: await textoDo('maria-exemplo-1'), canal: 'ligacao', revisei: true }, IGOR)
    expect(linhas()).not.toContain('Maria Exemplo · Orientar para a perícia')
    const t = await marcarMaria(false, 'comprovante novo 2026-10-28.pdf')
    expect(t.pericia.preparacao).toBeUndefined()
    expect(t.pericia.orientacao!.texto).toContain('Quando: quarta, 28/10, às 08:30.')
    expect(t.pericia.historico.at(-1)?.oQue).toBe('A data ou o local mudou: a orientação passada antes deixou de valer; ligar e orientar de novo')
    expect(linhas()).toContain('Maria Exemplo · Orientar para a perícia')
  })

  it('CA8 · "o cliente me ligou": a próxima tarefa e a orientação pronta, sem executar nada', async () => {
    const r = clienteLigou('O Antônio me ligou. O que eu falo para ele?')
    expect(r.texto).toBe(
      'A próxima tarefa é sua: orientar Antônio para a perícia de 16/10. A orientação da IA está pronta com data, local, o que levar e como é a perícia médica: ' +
        'sexta, 16/10, às 10:30, em Vara Federal de Santo Amaro (exemplo) · sala de perícias; levar documento com foto, carteira de trabalho, laudos, ' +
        'exames, receitas e atestados. Nunca oriente a esconder ou mudar a situação real (G11).',
    )
    expect(r.itens).toEqual([
      { cliente: 'Antônio Exemplo', acao: 'Orientar para a perícia', sub: 'perícia 16/10 · orientação da IA pronta', href: '/casos/antonio-exemplo-1/pericia/orientar' },
    ])
    expect((await obterPericia('antonio-exemplo-1'))!.pericia.preparacao).toBeUndefined()
    expect(clienteLigou('A Maria ligou agora').texto).toBe('A próxima tarefa é sua: marcar perícia de Maria. A orientação sai quando a perícia tiver data.')
    expect(clienteLigou('O cliente me ligou').texto).toBe('Diga o nome do cliente que ligou: eu mostro a próxima tarefa e a orientação.')
    await enviarOrientacao('antonio-exemplo-1', { texto: await textoDo('antonio-exemplo-1'), canal: 'ligacao', revisei: true }, IGOR)
    expect(clienteLigou('O Antônio ligou de novo').texto).toContain('Antônio já recebeu a orientação em 07/10 (na ligação).')
  })
})

describe('GGVP-66 · comparecimento e remarcação', () => {
  const ANTONIO = 'antonio-exemplo-1'
  const doAntonio = () => tarefasDoJuridicoAdm().filter((t) => t.cliente?.id === 'antonio-exemplo')
  // A semente nasce em 07/10: a perícia do Antônio fica em 16/10, 10:30, antes de o relógio andar.
  beforeEach(() => void doAntonio())

  it('CA7, CA8 · na véspera, a confirmação de presença na Central; passou das 16h sem confirmar, o alerta para contatar', async () => {
    agora = new Date(2026, 9, 14, 9, 0)
    expect(doAntonio().some((t) => t.acao === 'Confirmar presença na perícia')).toBe(false)
    agora = new Date(2026, 9, 15, 9, 0)
    expect(doAntonio().find((t) => t.acao === 'Confirmar presença na perícia')).toMatchObject({
      codigo: 'DP.07',
      detalhe: 'Aposentadoria por Incapacidade Permanente · perícia médica amanhã, 10:30 · confirmar até 16h',
      prazo: 'hoje',
      urgente: true,
      href: '/casos/antonio-exemplo-1/pericia/comparecimento',
    })
    agora = new Date(2026, 9, 15, 16, 30)
    expect(doAntonio().find((t) => t.acao === 'Confirmar presença na perícia')?.detalhe).toBe(
      'Aposentadoria por Incapacidade Permanente · perícia médica amanhã, 10:30 · presença não confirmada até 16h: contatar o cliente',
    )
  })

  it('CA7 · o resultado da confirmação fica registrado: sem confirmar, a tarefa segue; confirmado, sai', async () => {
    agora = new Date(2026, 9, 15, 10, 0)
    await expect(confirmarPresenca(ANTONIO, { confirmou: false }, IGOR)).rejects.toThrow('Diga o que aconteceu na tentativa (não atendeu, caixa postal…).')
    await confirmarPresenca(ANTONIO, { confirmou: false, observacao: 'não atendeu' }, IGOR)
    expect(doAntonio().find((t) => t.acao === 'Confirmar presença na perícia')?.detalhe).toContain('não confirmou: não atendeu')
    const t = await confirmarPresenca(ANTONIO, { confirmou: true }, IGOR)
    expect(t.pericia.marcacao!.confirmacao).toEqual({ quando: agora.toISOString(), quem: IGOR, confirmou: true })
    expect(t.pericia.historico.slice(-2).map((e) => e.oQue)).toEqual(['Não conseguiu confirmar a presença: não atendeu', 'Confirmou a presença do cliente na perícia'])
    expect(doAntonio().some((t) => t.acao === 'Confirmar presença na perícia')).toBe(false)
  })

  it('CA1 · só depois do dia e da hora: "Registrar comparecimento"; a orientação e a confirmação saem da Central', async () => {
    agora = new Date(2026, 9, 16, 10, 0)
    await expect(registrarComparecimento(ANTONIO, { compareceu: true }, IGOR)).rejects.toThrow(
      'A perícia ainda não aconteceu: o comparecimento abre depois de 16/10, 10:30.',
    )
    agora = new Date(2026, 9, 16, 11, 0)
    expect(doAntonio().map((t) => t.acao)).toEqual(['Registrar comparecimento'])
    expect(doAntonio()[0]).toMatchObject({ codigo: 'DP.07', prazo: 'hoje', href: '/casos/antonio-exemplo-1/pericia/comparecimento' })
    expect((await obterPericia(ANTONIO))!.jaPassou).toBe(true)
  })

  it('CA6 · no dia seguinte sem registro, o alerta para o Jurídico administrativo', () => {
    agora = new Date(2026, 9, 17, 9, 0)
    expect(doAntonio()[0]).toMatchObject({
      acao: 'Registrar comparecimento',
      prazo: 'atrasada desde 16/10',
      urgente: true,
      detalhe:
        'Aposentadoria por Incapacidade Permanente · perícia médica em 16/10, 10:30 · Vara Federal de Santo Amaro (exemplo) · sala de perícias · alerta: o comparecimento não foi registrado',
    })
  })

  it('CA4, CA5 · compareceu: espera o perito e o resultado, e a advogada responsável acompanha no processo', async () => {
    agora = new Date(2026, 9, 16, 14, 0)
    const t = await registrarComparecimento(ANTONIO, { compareceu: true, justificativa: '  ' }, IGOR)
    expect(t.situacao).toBe('aguardando-resultado')
    expect(t.pericia.marcacao!.comparecimento).toEqual({ quando: agora.toISOString(), quem: IGOR, compareceu: true })
    expect(t.pericia.historico.slice(-2)).toEqual([
      { quando: agora.toISOString(), quem: IGOR, oQue: 'Registrou que Antônio compareceu à perícia médica', passo: 'DP.07' },
      { quando: agora.toISOString(), quem: 'Sistema', oQue: 'Esperando o perito e o resultado (DP.E3, DP.E4): a advogada responsável acompanha no processo', passo: 'DP.E4' },
    ])
    expect(doAntonio()).toEqual([])
    expect(tarefasDaAdvogadaNaPericia()).toMatchObject([
      {
        codigo: 'DP.08',
        acao: 'Conferir resultado da perícia',
        cliente: { id: 'antonio-exemplo' },
        detalhe: 'Aposentadoria por Incapacidade Permanente · perícia médica feita em 16/10 · esperando o resultado no processo',
        urgente: false,
      },
    ])
    const evento = (await eventosDaAgenda('2026-10-16', '2026-10-16')).find((e) => e.categoria === 'pericias')!
    expect(evento.estado).toBe('realizado')
    await expect(remarcarPericia(ANTONIO, 'tentar de novo', IGOR)).rejects.toThrow('A perícia já foi feita: o cliente compareceu.')
  })

  it('CA2, CA4 · não compareceu: a justificativa fica, a tarefa volta para remarcar e conta no limite', async () => {
    agora = new Date(2026, 9, 16, 14, 0)
    const t = await registrarComparecimento(ANTONIO, { compareceu: false, justificativa: 'internado na véspera' }, IGOR)
    expect(t.situacao).toBe('marcar')
    expect(t.pericia.remarcacoes).toBe(1)
    expect(t.pericia.marcacoesAnteriores!.at(-1)!.comparecimento).toMatchObject({ compareceu: false, justificativa: 'internado na véspera' })
    expect(t.pericia.historico.slice(-2).map((e) => e.oQue)).toEqual([
      'Registrou que Antônio não compareceu (internado na véspera)',
      'Remarcação 1: Antônio não compareceu (internado na véspera)',
    ])
    expect(doAntonio().map((x) => x.acao)).toEqual(['Remarcar perícia'])
  })

  it('CA3 · a falta que passa do limite sobe para a advogada responsável (G15), nunca para a sênior', async () => {
    const banco = ler()
    banco.pericias!.find((p) => p.processoId === ANTONIO)!.remarcacoes = 2
    gravar(banco)
    agora = new Date(2026, 9, 16, 14, 0)
    const t = await registrarComparecimento(ANTONIO, { compareceu: false }, IGOR)
    expect(t.situacao).toBe('na-advogada')
    expect(t.pericia.historico.at(-3)?.oQue).toBe('Registrou que Antônio não compareceu (sem justificativa)')
    expect(t.pericia.historico.at(-1)?.oQue).toBe('Passou do limite de 2 remarcações: a perícia subiu para a advogada responsável (G15)')
    expect(doAntonio()).toEqual([])
    expect(tarefasDaAdvogadaNaPericia()).toMatchObject([{ acao: 'Decidir a perícia', cliente: { id: 'antonio-exemplo' } }])
  })

  it('CA9 · o cliente avisa antes que não pode ir: remarca na hora, com o motivo, e conta no limite', async () => {
    agora = new Date(2026, 9, 15, 10, 0)
    const t = await remarcarPericia(ANTONIO, 'avisou que vai estar internado', IGOR)
    expect(t.pericia.remarcacoes).toBe(1)
    expect(t.pericia.historico.at(-1)?.oQue).toBe('Remarcação 1: avisou que vai estar internado')
    expect(doAntonio().map((x) => x.acao)).toEqual(['Remarcar perícia'])
  })
})
