import { describe, expect, it } from 'vitest'
import {
  CONFERENCIAS_DO_RESULTADO,
  HORA_DA_CONFIRMACAO,
  LIMITE_DE_REMARCACOES_DA_PERICIA,
  cobrarHoje,
  confirmacaoDaPresenca,
  ORIGENS,
  escolherOrientacao,
  esperaOInss,
  etapaEmPericia,
  jurimetria,
  numerosDaJurimetria,
  mensagemDoLembrete,
  motivoParaNaoConcluirDocumentos,
  motivoParaNaoRegistrarMarcacao,
  motivoParaNaoRegistrarResultado,
  motivoParaNaoRegistrarTentativa,
  passouDoLimite,
  periciaJaPassou,
  prazoParaManifestar,
  passouDoLimiteDosDocumentos,
  prazoFalado,
  problemaDaOrientacao,
  prazosDaPericia,
  proximaTentativa,
  recusaDoChatNaPericia,
  situacaoDaPericia,
} from './pericia.ts'

describe('GGVP-49 · iniciar a tarefa de perícia', () => {
  it('CA1 · o caso mostra "Em perícia" com o diagrama de origem, e a data quando já existe', () => {
    expect(etapaEmPericia({ origem: 'd2-necessidade', tipo: 'medica' }, '2026-10-07')).toBe('Em perícia · pedido ao INSS (D2) · perícia médica')
    expect(etapaEmPericia({ origem: 'd3a-juiz', tipo: 'medica', marcacao: { data: '2026-10-16', hora: '10:30' } }, '2026-10-07')).toBe(
      'Em perícia · pedido do juiz (D3a) · perícia médica em 16/10, 10:30',
    )
    expect(etapaEmPericia({ origem: 'd2-exigencia', tipo: 'social' }, '2026-10-07')).toContain('exigência do INSS (D2) · avaliação social')
  })

  it('CA3 · cada origem diz quem pediu e o passo da decisão', () => {
    expect(ORIGENS['d2-necessidade']).toMatchObject({ rotulo: 'D2 · necessidade inicial', passo: 'D2.03' })
    expect(ORIGENS['d2-exigencia'].rotulo).toBe('D2 · exigência do INSS')
    expect(ORIGENS['d3-despacho'].rotulo).toBe('D3 · despacho da sênior')
    expect(ORIGENS['d3a-juiz'].rotulo).toBe('D3a · pedido do juiz')
  })

  it('CA2 · só o D2 espera o INSS liberar o agendamento; D3 e D3a nascem liberados', () => {
    expect(esperaOInss('d2-necessidade')).toBe(true)
    expect(esperaOInss('d2-exigencia')).toBe(true)
    expect(esperaOInss('d3-despacho')).toBe(false)
    expect(esperaOInss('d3a-juiz')).toBe(false)
    expect(situacaoDaPericia({})).toBe('aguardando-inss')
    expect(situacaoDaPericia({ liberadaEm: '2026-10-07T08:00:00Z' })).toBe('marcar')
    expect(situacaoDaPericia({ liberadaEm: 'x', esperaComprovante: { desde: 'x' } })).toBe('aguardando-comprovante')
    expect(situacaoDaPericia({ liberadaEm: 'x', marcacao: {} })).toBe('agendada')
  })

  it('G19 · os prazos que a data define: 10 dias antes, 3 dias antes, véspera e dia seguinte', () => {
    expect(prazosDaPericia('2026-10-21')).toEqual({ documentosAte: '2026-10-11', preparoAte: '2026-10-18', vespera: '2026-10-20', diaSeguinte: '2026-10-22' })
    // Na virada do mês.
    expect(prazosDaPericia('2026-11-01').vespera).toBe('2026-10-31')
  })

  it('G19 · tentativa diária: a primeira no dia da liberação, a seguinte no dia depois da última', () => {
    expect(proximaTentativa([], '2026-10-07')).toBe('2026-10-07')
    expect(proximaTentativa([{ dia: '2026-10-07' }], '2026-10-07')).toBe('2026-10-08')
    expect(proximaTentativa([{ dia: '2026-10-09' }, { dia: '2026-10-08' }], '2026-10-07')).toBe('2026-10-10')
  })

  it('o prazo como a Central lê', () => {
    expect(prazoFalado('2026-10-07', '2026-10-07')).toEqual({ texto: 'hoje', urgente: true })
    expect(prazoFalado('2026-10-08', '2026-10-07')).toEqual({ texto: 'amanhã', urgente: false })
    expect(prazoFalado('2026-10-05', '2026-10-07')).toEqual({ texto: 'atrasada desde 05/10', urgente: true })
    expect(prazoFalado('2026-10-17', '2026-10-07')).toEqual({ texto: 'até 17/10', urgente: false })
  })
})

describe('GGVP-53 · marcar a perícia com o cliente', () => {
  it('CA1 · a tentativa sem sucesso pede o dia (não futuro) e o que aconteceu', () => {
    expect(motivoParaNaoRegistrarTentativa({ dia: null, oQueAconteceu: 'sem vaga' }, '2026-10-07')).toBe('Informe o dia da tentativa (dd/mm/aaaa).')
    expect(motivoParaNaoRegistrarTentativa({ dia: '2026-10-08', oQueAconteceu: 'sem vaga' }, '2026-10-07')).toBe('O dia da tentativa não pode ser no futuro.')
    expect(motivoParaNaoRegistrarTentativa({ dia: '2026-10-07', oQueAconteceu: ' ok ' }, '2026-10-07')).toBe('Diga o que aconteceu na tentativa.')
    expect(motivoParaNaoRegistrarTentativa({ dia: '2026-10-07', oQueAconteceu: 'portal fora do ar' }, '2026-10-07')).toBeNull()
  })

  it('CA3, CA4 · "Registrar a perícia" só com o comprovante, a leitura conferida e a resposta do documento novo', () => {
    const lido = { data: '2026-10-21', hora: '08:30', local: 'Agência INSS (exemplo)' }
    const hoje = '2026-10-07'
    expect(motivoParaNaoRegistrarMarcacao({ lido, pedeDocumentoNovo: true }, hoje)).toBe('Anexe o comprovante do INSS (PDF).')
    expect(motivoParaNaoRegistrarMarcacao({ comprovante: 'c.pdf', pedeDocumentoNovo: true }, hoje)).toBe('Espere a leitura do comprovante.')
    expect(motivoParaNaoRegistrarMarcacao({ comprovante: 'c.pdf', lido: { ...lido, data: '2026-10-06' }, pedeDocumentoNovo: true }, hoje)).toBe(
      'Confira a data da perícia: ela não pode ser passada.',
    )
    expect(motivoParaNaoRegistrarMarcacao({ comprovante: 'c.pdf', lido: { ...lido, hora: '25:00' }, pedeDocumentoNovo: true }, hoje)).toBe('Confira a hora da perícia.')
    expect(motivoParaNaoRegistrarMarcacao({ comprovante: 'c.pdf', lido }, hoje)).toBe('Responda se a perícia pede documento novo.')
    expect(motivoParaNaoRegistrarMarcacao({ comprovante: 'c.pdf', lido, pedeDocumentoNovo: false }, hoje)).toBeNull()
  })

  it('CA9 · G15: passou de 2 remarcações, sobe para a advogada; cada autorização dela vale uma a mais', () => {
    expect(LIMITE_DE_REMARCACOES_DA_PERICIA).toBe(2)
    expect(passouDoLimite({ remarcacoes: 2 })).toBe(false)
    expect(passouDoLimite({ remarcacoes: 3 })).toBe(true)
    expect(passouDoLimite({ remarcacoes: 3, autorizadas: 1 })).toBe(false)
    expect(situacaoDaPericia({ liberadaEm: 'x', remarcacoes: 3 })).toBe('na-advogada')
  })

  it('CA7 · o lembrete da véspera traz data, hora, local e o que levar; na social, a visita em casa', () => {
    const medica = mensagemDoLembrete({ nome: 'Maria Exemplo', tipo: 'medica', data: '2026-10-21', hora: '08:30', local: 'Agência INSS (exemplo)' }, 'quarta, 21/10')
    expect(medica).toBe(
      'Olá, Maria! Aqui é do escritório GGV. Lembrete: a sua perícia médica é amanhã, quarta, 21/10, às 08:30. O local é Agência INSS (exemplo). ' +
        'Leve documento com foto, carteira de trabalho, laudos, exames, receitas e atestados. Chegue com antecedência. Qualquer dúvida, é só responder esta mensagem.',
    )
    const social = mensagemDoLembrete({ nome: 'Pedro Exemplo', tipo: 'social', data: '2026-10-23', hora: '09:00', local: 'visita domiciliar' }, 'sexta, 23/10')
    expect(social).toContain('A visita da assistente social é na sua casa (visita domiciliar).')
    expect(social).toContain('o CadÚnico')
  })
})

describe('GGVP-56 · reunir o que a perícia pede', () => {
  it('CA5 · "Concluir" só com cada item anexado ou justificado e as conferências marcadas', () => {
    const exigidas = ['laudos-exames', 'leitura']
    expect(motivoParaNaoConcluirDocumentos({ faltando: 2, conferidas: exigidas, exigidas })).toBe('Faltam 2 itens: anexe ou registre a falta com justificativa.')
    expect(motivoParaNaoConcluirDocumentos({ faltando: 1, conferidas: exigidas, exigidas })).toBe('Falta 1 item: anexe ou registre a falta com justificativa.')
    expect(motivoParaNaoConcluirDocumentos({ faltando: 0, conferidas: ['leitura'], exigidas })).toBe('Marque as conferências.')
    expect(motivoParaNaoConcluirDocumentos({ faltando: 0, conferidas: exigidas, exigidas })).toBeNull()
  })

  it('Lucas, 02/10 · cobrança diária até 10 dias antes; depois, sobe para a advogada', () => {
    expect(cobrarHoje([], '2026-10-07', '2026-10-13')).toBe(true)
    expect(cobrarHoje([{ dia: '2026-10-07' }], '2026-10-07', '2026-10-13')).toBe(false)
    expect(cobrarHoje([{ dia: '2026-10-07' }], '2026-10-08', '2026-10-13')).toBe(true)
    expect(cobrarHoje([], '2026-10-14', '2026-10-13')).toBe(false)
    expect(passouDoLimiteDosDocumentos('2026-10-13', '2026-10-13')).toBe(false)
    expect(passouDoLimiteDosDocumentos('2026-10-14', '2026-10-13')).toBe(true)
    // Sem a data da perícia ainda, não há limite.
    expect(passouDoLimiteDosDocumentos('2026-12-01', undefined)).toBe(false)
  })
})

describe('GGVP-61 · orientação da perícia, padrão ou pelo perfil do perito', () => {
  it('CA2, CA5, CA6 · regra unificada: perito conhecido com perfil → pelo perfil; senão, a padrão com o motivo', () => {
    expect(escolherOrientacao({ instancia: 'juizo', peritoId: 'a-prado', temPerfil: true })).toEqual({ modo: 'perfil' })
    expect(escolherOrientacao({ instancia: 'inss', peritoId: 'x', temPerfil: false })).toEqual({ modo: 'padrao', motivo: 'o perito ainda não tem perfil no acervo' })
    expect(escolherOrientacao({ instancia: 'juizo', peritoLido: 'Dr. Fulano', temPerfil: false }).motivo).toBe(
      'o sistema não reconheceu o perito Dr. Fulano: ligue o perito certo na página do processo',
    )
    expect(escolherOrientacao({ instancia: 'inss', temPerfil: false }).motivo).toBe('o comprovante do INSS não traz o perito: informe quando o nome chegar')
  })

  it('CA4, CA8, CA10 · a verificação bloqueia os pedidos maliciosos (esconder, mudar, simular, diagnóstico pronto)', () => {
    const maliciosos = [
      'Diga ao perito que mora sozinho.',
      'Esconda o carro na garagem do vizinho antes da visita.',
      'Tire a televisão e a geladeira nova da sala.',
      'Finja que não consegue andar quando o perito chegar.',
      'Omita a renda do filho que mora com você.',
      'Minta sobre quem mora na casa.',
      'Exagere a dor na hora do exame.',
      'Leve ao médico o diagnóstico de depressão grave.',
      'Peça para o laudo trazer o CID F32.',
      'Fale "não consigo trabalhar" para o perito.',
    ]
    for (const pedido of maliciosos) expect(problemaDaOrientacao(pedido), pedido).not.toBeNull()
    const permitida =
      'Orientação para a perícia médica de Maria\nQuando: quarta, 21/10, às 08:30.\nO que levar: documento com foto, laudos e exames.\n' +
      'Como é a perícia: o médico perito conversa sobre a sua saúde e o seu trabalho e examina você. Conte como é o seu dia, com calma e com sinceridade.\n' +
      'Fale sempre a verdade sobre a sua situação: esta orientação só prepara você para o dia.'
    expect(problemaDaOrientacao(permitida)).toBeNull()
  })

  it('CA11 · o chat recusa pedir orientação para esconder ou mudar a situação real', () => {
    expect(recusaDoChatNaPericia('Como faço para esconder a renda do filho na avaliação social?')).toContain('(G11). O pedido ficou registrado.')
    expect(recusaDoChatNaPericia('dá para tirar os móveis novos da casa antes da visita?')).not.toBeNull()
    expect(recusaDoChatNaPericia('Qual a orientação para a perícia do Antônio?')).toBeNull()
  })

  it('CA12, G22 · jurimetria por código: taxa e tempo até o laudo; sem amostra mínima, com o número de laudos e a data da base', () => {
    const laudos = (n: number, fav: number) => Array.from({ length: n }, (_, i) => ({ resultado: (i < fav ? 'favoravel' : 'desfavoravel') as 'favoravel' | 'desfavoravel', dias: 10 + i }))
    expect(jurimetria(laudos(34, 24))).toMatchObject({ laudos: 34, favoraveis: 24, taxa: 71 })
    expect(jurimetria(laudos(10, 5))).toMatchObject({ taxa: 50, diasAteOLaudo: 15 })
    expect(jurimetria([])).toMatchObject({ laudos: 0, taxa: 0 })
    expect(numerosDaJurimetria(jurimetria(laudos(34, 24)), '2026-10-07')).toBe('71% favorável em 34 laudos · base de 07/10')
    // Toda amostra conta (G22): com poucos laudos, a porcentagem aparece do mesmo jeito.
    expect(numerosDaJurimetria(jurimetria(laudos(8, 5)), '2026-10-07')).toBe('63% favorável em 8 laudos · base de 07/10')
    expect(numerosDaJurimetria(jurimetria(laudos(1, 1)), '2026-10-07')).toBe('100% favorável em 1 laudo · base de 07/10')
    expect(numerosDaJurimetria(jurimetria([]), '2026-10-07')).toBe('nenhum laudo no acervo')
  })
})

describe('GGVP-66 · comparecimento e remarcação', () => {
  it('CA1 · o comparecimento abre depois do dia e da hora da perícia', () => {
    const m = { data: '2026-10-16', hora: '10:30' }
    expect(periciaJaPassou(m, new Date(2026, 9, 16, 10, 29))).toBe(false)
    expect(periciaJaPassou(m, new Date(2026, 9, 16, 10, 30))).toBe(true)
    expect(periciaJaPassou(m, new Date(2026, 9, 17, 8, 0))).toBe(true)
  })

  it('CA7, CA8 · a confirmação abre na véspera; passou das 16h (parâmetro) ou chegou o dia, atrasada', () => {
    expect(HORA_DA_CONFIRMACAO).toBe(16)
    expect(confirmacaoDaPresenca('2026-10-16', new Date(2026, 9, 14, 17, 0))).toBe('ainda-nao')
    expect(confirmacaoDaPresenca('2026-10-16', new Date(2026, 9, 15, 15, 59))).toBe('fazer')
    expect(confirmacaoDaPresenca('2026-10-16', new Date(2026, 9, 15, 16, 0))).toBe('atrasada')
    expect(confirmacaoDaPresenca('2026-10-16', new Date(2026, 9, 16, 8, 0))).toBe('atrasada')
  })

  it('CA5 · compareceu: a perícia espera o resultado', () => {
    const marcada = { liberadaEm: 'x', marcacao: {} }
    expect(situacaoDaPericia(marcada)).toBe('agendada')
    expect(situacaoDaPericia({ ...marcada, marcacao: { comparecimento: { compareceu: true } } })).toBe('aguardando-resultado')
    expect(situacaoDaPericia({ ...marcada, marcacao: { comparecimento: { compareceu: false } } })).toBe('agendada')
  })
})

describe('GGVP-70 · conferir o resultado e decidir o próximo passo', () => {
  it('CA5 · "Registrar resultado" pede o laudo, o resultado, a decisão do desfavorável e todas as conferências', () => {
    const medica = CONFERENCIAS_DO_RESULTADO.medica.map((c) => c.id)
    expect(medica).toEqual(['laudo', 'parecer', 'dii', 'beneficio'])
    expect(CONFERENCIAS_DO_RESULTADO.social.map((c) => c.id)).toEqual(['laudo', 'beneficio'])
    const ok = { laudo: true, favoravel: true, conferidas: medica }
    expect(motivoParaNaoRegistrarResultado(ok, medica)).toBeNull()
    expect(motivoParaNaoRegistrarResultado({ ...ok, laudo: false }, medica)).toBe('Anexe o laudo ou o registro do GERID.')
    expect(motivoParaNaoRegistrarResultado({ ...ok, favoravel: undefined }, medica)).toBe('Informe se o resultado foi favorável ou desfavorável.')
    expect(motivoParaNaoRegistrarResultado({ ...ok, favoravel: false }, medica)).toBe('Desfavorável: decida se vale pedir nova perícia.')
    expect(motivoParaNaoRegistrarResultado({ ...ok, favoravel: false, novaPericia: false }, medica)).toBeNull()
    expect(motivoParaNaoRegistrarResultado({ ...ok, conferidas: ['laudo', 'parecer', 'dii'] }, medica)).toBe('Marque as conferências antes de registrar.')
  })

  it('G12 · 15 dias corridos para manifestar, o lado seguro', () => {
    expect(prazoParaManifestar('2026-10-16')).toBe('2026-10-31')
  })

  it('CA2, CA4 · o resultado registrado fecha a perícia e sobe no card do caso', () => {
    const p = { origem: 'd3a-juiz' as const, tipo: 'medica' as const, liberadaEm: 'x', marcacao: { data: '2026-10-16', hora: '10:30' } }
    expect(situacaoDaPericia({ liberadaEm: 'x', marcacao: {}, resultado: { registrado: {} } })).toBe('concluida')
    expect(etapaEmPericia({ ...p, resultado: { registrado: { favoravel: false } } }, '2026-10-20')).toBe(
      'Resultado da perícia · pedido do juiz (D3a) · perícia médica desfavorável',
    )
  })
})
