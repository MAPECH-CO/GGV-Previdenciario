import { gerarDvCnj } from '@ggv/campos'
import { describe, expect, it } from 'vitest'
import type { Legado } from './extrair.ts'
import { beneficioDoLegado, diaDoLegado, faseDoProcesso, idDoLegado, momentoDoLegado, transformar } from './transformar.ts'

// Nenhuma pessoa é real: nomes e dados de exemplo; os CPFs são os de teste que passam no dígito verificador.
const CPF_ANA = '529.982.247-25'
const CPF_CARLA = '111.444.777-35'
const CNJ = `0001234${gerarDvCnj('0001234', '2024', '4', '03', '6301')}20244036301`
const CNJ_FORMATADO = `0001234-${CNJ.slice(7, 9)}.2024.4.03.6301`

const cliente = (sobrescreve: Partial<Legado['clientesDoBackup'][number]>): Legado['clientesDoBackup'][number] => ({
  id: 'b0',
  nome: null,
  cpf: null,
  dataNascimento: null,
  status: null,
  motivoNaoAceite: null,
  email: null,
  telefone1: null,
  telefone2: null,
  cep: null,
  endereco: null,
  bairro: null,
  cidade: null,
  uf: null,
  dataContrato: null,
  pessoasNaCasa: null,
  rendaFamiliar: null,
  drivePastaId: null,
  criadoEm: '2025-08-20 10:00:00+00',
  ...sobrescreve,
})
const juridico = (sobrescreve: Partial<Legado['clientesDoJuridico'][number]>): Legado['clientesDoJuridico'][number] => ({
  id: 0,
  codigo: 'CLI-0000',
  nome: null,
  cpf: null,
  status: null,
  statusLegado: null,
  dataNascimento: null,
  email: null,
  telefone1: null,
  telefone2: null,
  cep: null,
  logradouro: null,
  bairro: null,
  cidade: null,
  uf: null,
  dataContrato: null,
  pessoasNaCasa: null,
  rendaFamiliarCentavos: null,
  drivePastaId: null,
  criadoEm: '2025-08-22',
  ...sobrescreve,
})
const processo = (sobrescreve: Partial<Legado['processos'][number]>): Legado['processos'][number] => ({
  id: 'p0',
  clienteId: 'b0',
  area: 'Previdenciário',
  etapaAtual: null,
  statusGeral: null,
  numeroCnj: null,
  dataProtocoloJudicial: null,
  dataEntradaJudicial: null,
  vara: null,
  valorCausa: null,
  vias: null,
  criadoEm: '2025-08-20 10:00:00+00',
  atualizadoEm: '2025-08-20 10:00:00+00',
  ...sobrescreve,
})

/** Três aceitos (dois pelo juridico, um só do backup), dois fora, cinco processos (um de quem não entra). */
function legadoDeTeste(): Legado {
  return {
    clientesDoJuridico: [
      juridico({ id: 1, codigo: 'CLI-0001', nome: '  Ana  Lima Teste ', cpf: CPF_ANA, status: 'ACEITO', telefone1: '(11) 99999-0001', cep: '01001-000', logradouro: 'Rua Teste, 10', cidade: 'São Paulo', uf: 'sp', pessoasNaCasa: 3, rendaFamiliarCentavos: 300000, dataContrato: '2024-03-01', dataNascimento: '15/05/1960' }),
      juridico({ id: 2, codigo: 'CLI-0002', nome: 'Bruno Costa Teste', status: 'NAO_ACEITO' }),
      juridico({ id: 3, codigo: 'CLI-0003', nome: 'Carla Dias Teste', cpf: CPF_CARLA, status: 'ACEITO', uf: 'XX', dataNascimento: '2030-01-01' }),
    ],
    clientesDoBackup: [
      cliente({ id: 'b1', nome: 'Ana Lima Teste', cpf: CPF_ANA, status: 'Aceito', telefone1: '123', email: 'Ana@Exemplo.com ', dataContrato: '2024-03-01' }),
      cliente({ id: 'b1b', nome: 'ANA LIMA TESTE', cpf: '52998224725', status: 'Aceito', telefone1: '+55 11 98888-0002' }),
      cliente({ id: 'b2', nome: 'Bruno Costa Teste', status: 'Aceito' }),
      cliente({ id: 'b3', nome: 'Carla Dias', cpf: CPF_CARLA, status: 'Não Aceito', cep: '99' }),
      cliente({ id: 'b4', nome: 'Dora Souza Teste', cpf: '111.111.111-11', status: 'Aceito', email: 'sem-arroba', dataContrato: '2023-11-20' }),
      cliente({ id: 'b5', nome: 'Edu Teste', status: 'Follow Up' }),
    ],
    processos: [
      processo({ id: 'p1', clienteId: 'b1', statusGeral: 'Concedido e Encerrado no Administrativo', etapaAtual: 'Administrativo' }),
      processo({ id: 'p2', clienteId: 'b1b', numeroCnj: CNJ_FORMATADO }),
      processo({ id: 'p3', clienteId: 'b3', statusGeral: 'Coisa Julgada Improcedente', numeroCnj: '123', vara: ' 2ª Vara Federal ', valorCausa: 15000 }),
      processo({ id: 'p4', clienteId: 'b5', statusGeral: 'Processo em Curso Judicial' }),
      processo({ id: 'p5', clienteId: 'b4', statusGeral: 'Indeferido Administrativo' }),
    ],
    beneficios: [
      { processoId: 'p1', nome: 'LOAS Idoso', ordem: 1, ativo: true, resultadoAdministrativo: 'Concedido e Encerrado no Administrativo', dataIndeferimentoAdministrativo: null, resultadoJudicial: null, dataConcessao: '2024-06-10', dataIndeferimentoJudicial: null },
      { processoId: 'p2', nome: 'Revisão para Vida Toda', ordem: 1, ativo: true, resultadoAdministrativo: null, dataIndeferimentoAdministrativo: null, resultadoJudicial: null, dataConcessao: null, dataIndeferimentoJudicial: null },
      { processoId: 'p3', nome: 'LOAS Deficiente', ordem: 1, ativo: true, resultadoAdministrativo: null, dataIndeferimentoAdministrativo: null, resultadoJudicial: 'Coisa Julgada Improcedente', dataConcessao: null, dataIndeferimentoJudicial: '2025-02-02' },
    ],
    requerimentos: [
      { id: 'r1', processoId: 'p1', tipo: 'LOAS Idoso', numeroProtocolo: '123456789', der: '2024-03-15', etapa: 'Concedido e Encerrado no Administrativo', dataDecisao: '2024-06-10', criadoEm: null, atualizadoEm: null },
      { id: 'r5', processoId: 'p5', tipo: 'Auxilio por Incapacidade', numeroProtocolo: '1234-56789', der: '2024-08-01', etapa: 'Indeferido Administrativo', dataDecisao: null, criadoEm: null, atualizadoEm: null },
      { id: 'r3', processoId: 'p3', tipo: 'LOAS Deficiente', numeroProtocolo: '555555555', der: '2023-05-05', etapa: 'Indeferido Administrativo', dataDecisao: null, criadoEm: null, atualizadoEm: null },
    ],
    agenda: [
      { id: 'a1', clienteId: 'b1', processoId: 'p1', tipo: 'Avaliação Social', data: '2024-05-02', dataHora: null, status: 'Hipossuficiência comprovada', local: 'APS Itaquera' },
      { id: 'a2', clienteId: 'b1', processoId: 'p1', tipo: 'Visita', data: '2024-03-05', dataHora: null, status: 'Cumprida', local: null },
      { id: 'a3', clienteId: 'b1b', processoId: 'p2', tipo: 'Perícia Médica e Social', data: '2025-03-03', dataHora: '2025-03-03 13:30:00+00', status: null, local: 'Fórum' },
      { id: 'a4', clienteId: 'b3', processoId: 'p3', tipo: 'Perícia Médica', data: '2025-01-10', dataHora: null, status: 'Cancelada', local: null },
      { id: 'a5', clienteId: 'b4', processoId: null, tipo: 'Cadastro Único', data: '2024-01-10', dataHora: null, status: null, local: 'CRAS' },
    ],
    movimentacoes: [
      { id: 'm3', processoId: 'p1', tipo: 'Concessão do benefício', data: '2024-06-10', statusAnterior: 'Em Análise no INSS', statusNovo: 'Concedido', criadoEm: null },
      { id: 'm1', processoId: 'p1', tipo: 'Assinatura de contrato', data: '2024-03-01', statusAnterior: null, statusNovo: null, criadoEm: null },
      { id: 'm2', processoId: 'p1', tipo: 'Protocolo administrativo', data: '2024-03-15', statusAnterior: null, statusNovo: null, criadoEm: null },
      { id: 'm4', processoId: 'p2', tipo: 'Entrada no judicial', data: '2025-01-10', statusAnterior: null, statusNovo: null, criadoEm: null },
      { id: 'm5', processoId: 'p5', tipo: 'Indeferimento administrativo', data: '2024-09-09', statusAnterior: null, statusNovo: null, criadoEm: null },
    ],
    captacoes: [{ clienteId: 'b1', canal: null, fonteTipo: 'Indicação', fonteNome: null, data: '2024-02-20' }],
  }
}

const AGORA = new Date('2026-10-16T12:00:00Z')

describe('quem entra: só o aceito, e o juridico manda sobre o backup', () => {
  const carga = transformar(legadoDeTeste(), AGORA)
  const r = carga.relatorio

  it('liga pelo CPF e, sem CPF, pelo nome; aceito é o status do juridico, ou o do backup para quem só está lá', () => {
    expect(r.clientes.lidos).toEqual({ backup: 6, juridico: 3 })
    expect(r.clientes.ligados).toEqual({ porCpf: 3, porNome: 1 })
    expect(r.clientes.aceitos).toEqual({ juridico: 2, soBackup: 1, divergentesDoBackup: 1 })
    expect(r.clientes.foraPorStatus).toEqual({ 'juridico: NAO_ACEITO': 1, 'backup: Follow Up': 1 })
    expect(carga.pessoas.map((p) => p.nome)).toEqual(['Ana Lima Teste', 'Carla Dias Teste', 'Dora Souza Teste'])
    expect(r.clientes.gravados).toBe(3)
    expect(r.processos).toMatchObject({ lidos: 5, deAceitos: 4, gravados: 4, foraDeNaoAceitos: 1 })
  })

  it('cada campo passa pela biblioteca campos: o inválido fica nulo e é contado, o juridico vem primeiro', () => {
    const [ana, carla, dora] = carga.pessoas
    expect(ana).toMatchObject({
      id: idDoLegado('pessoa', 'juridico:1'),
      cpf: '52998224725',
      dataNascimento: '1960-05-15',
      telefone: '11999990001',
      telefone2: '11988880002',
      email: 'ana@exemplo.com',
      cep: '01001000',
      logradouro: 'Rua Teste, 10',
      cidade: 'São Paulo',
      uf: 'SP',
      situacao: 'cliente',
      origem: 'Indicação',
      rendaPorPessoa: '1000.00',
      criadoEm: '2024-03-01T15:00:00.000Z',
    })
    expect(carla).toMatchObject({ cpf: '11144477735', uf: null, dataNascimento: null, cep: null })
    expect(dora).toMatchObject({ id: idDoLegado('pessoa', 'backup:b4'), cpf: null, email: null, criadoEm: '2023-11-20T15:00:00.000Z' })
    expect(r.clientes.campos).toEqual({ semNome: 0, nomeForaDoPadrao: 0, cpfInvalido: 1, nascimentoInvalido: 1, telefoneInvalido: 1, emailInvalido: 1, cepInvalido: 1, ufInvalida: 1, semOrigem: 2 })
    expect(r.clientes.unidosPorCpf).toBe(0)
  })

  it('o relatório só tem números: nenhum nome, CPF, telefone ou e-mail', () => {
    const texto = JSON.stringify(r)
    for (const dado of ['Ana', 'Carla', 'Dora', '52998224725', '529.982', '11999990001', 'exemplo.com', 'CLI-0001']) expect(texto).not.toContain(dado)
  })

  it('rodar de novo dá a mesma carga, com os mesmos ids', () => {
    expect(JSON.stringify(transformar(legadoDeTeste(), AGORA))).toBe(JSON.stringify(carga))
    expect(new Set(carga.eventos.map((e) => e.id)).size).toBe(carga.eventos.length)
  })
})

describe('os processos: benefício do catálogo, fase e desfecho pelo status, números uma vez só', () => {
  const carga = transformar(legadoDeTeste(), AGORA)
  const r = carga.relatorio
  const casoDe = (processoId: string) => carga.casos.find((c) => c.id === idDoLegado('caso', processoId))!

  it('o status geral vira fase e desfecho; o benefício, o do catálogo (a grafia antiga pelo mapa do legado)', () => {
    expect(casoDe('p1')).toMatchObject({ beneficio: 'bpc_loas_idoso', fase: 'encerrado', desfecho: 'deferido', encerradoEm: '2024-06-10T15:00:00.000Z', criadoEm: '2024-03-01T15:00:00.000Z' })
    expect(casoDe('p3')).toMatchObject({ beneficio: 'bpc_loas_deficiente', fase: 'encerrado', desfecho: 'improcedente', encerradoEm: '2025-02-02T15:00:00.000Z', vara: '2ª Vara Federal', valorCausa: '15000.00' })
    expect(casoDe('p5')).toMatchObject({ beneficio: 'auxilio_incapacidade_temporaria', fase: 'administrativa', desfecho: null, encerradoEm: null })
    expect(r.processos.porBeneficio).toEqual({ bpc_loas_idoso: 1, revisao_vida_toda: 1, bpc_loas_deficiente: 1, auxilio_incapacidade_temporaria: 1 })
    expect(r.processos.beneficioDesconhecido).toEqual({})
  })

  it('sem status geral, a fase vem da última movimentação, e o relatório conta a dedução', () => {
    expect(casoDe('p2')).toMatchObject({ beneficio: 'revisao_vida_toda', fase: 'judicial', desfecho: null })
    expect(r.processos.faseDeduzida).toBe(1)
    expect(r.processos.porFase).toEqual({ atendimento: 0, administrativa: 1, judicial: 1, encerrado: 2 })
  })

  it('o CNJ válido vira identificador (só dígitos); o inválido e o protocolo repetido ficam fora, contados', () => {
    expect(carga.identificadores.map((i) => [i.tipo, i.valor, i.casoId])).toEqual([
      ['protocolo_inss', '123456789', casoDe('p1').id],
      ['cnj', CNJ, casoDe('p2').id],
      ['protocolo_inss', '555555555', casoDe('p3').id],
    ])
    expect(r.processos.numeros).toEqual({ cnj: 1, cnjInvalido: 1, cnjRepetido: 0, protocolo: 2, protocoloRepetido: 1 })
  })

  it('a decisão do INSS vem do requerimento; sem data no requerimento, da movimentação; sem data nenhuma, só no histórico', () => {
    expect(carga.resultados.map((x) => [x.resultado, x.dataDecisao, x.casoId])).toEqual([
      ['deferido', '2024-06-10', casoDe('p1').id],
      ['indeferido', '2024-09-09', casoDe('p5').id],
    ])
    expect(r.resultadosInss).toEqual({ deferido: 1, indeferido: 1, semData: 1 })
    const semData = carga.eventos.find((e) => e.acao === 'legado_inss_indeferido_sem_data')!
    expect(semData).toMatchObject({ alvo: `caso:${casoDe('p3').id}`, quando: '2023-05-05T15:00:00.000Z', detalhe: { resultado: 'indeferido' } })
  })

  it('a perícia da agenda vira perícia do caso, no formato das telas, com o resultado e o comparecimento que havia', () => {
    const social = carga.pericias.find((p) => p.casoId === casoDe('p1').id)!
    expect(social).toMatchObject({ tipo: 'social', agendadaPara: '2024-05-02T03:00:00.000Z', local: 'APS Itaquera', compareceu: true, resultado: 'favoravel' })
    expect(social.documento).toMatchObject({
      processoId: casoDe('p1').id,
      fichaId: carga.pessoas[0].id,
      instancia: 'inss',
      marcacao: { data: '2024-05-02', hora: '00:00', local: 'APS Itaquera', comparecimento: { compareceu: true } },
      resultado: { registrado: { favoravel: true, quem: 'Portal antigo' } },
    })
    const doJudicial = carga.pericias.filter((p) => p.casoId === casoDe('p2').id)
    expect(doJudicial.map((p) => [p.tipo, p.agendadaPara, p.resultado, p.compareceu])).toEqual([
      ['medica', '2025-03-03T13:30:00.000Z', null, null],
      ['social', '2025-03-03T13:30:00.000Z', null, null],
    ])
    expect(doJudicial[0].documento).toMatchObject({ instancia: 'juizo', origem: 'd3-despacho', marcacao: { data: '2025-03-03', hora: '10:30', origem: 'juizo' } })
    expect(doJudicial[0].documento).not.toHaveProperty('resultado')
    expect(r.pericias).toEqual({ medica: 1, social: 2, comResultado: 1, semHora: 1, semProcesso: 0, canceladas: 1 })
  })

  it('o histórico ganha um evento por cliente, por processo, por movimentação e pelo resto da agenda, assinado pelo sistema', () => {
    expect(r.eventos.porAcao).toEqual({
      legado_cliente_importado: 3,
      legado_processo_importado: 4,
      legado_concessao_do_beneficio: 1,
      legado_assinatura_de_contrato: 1,
      legado_protocolo_administrativo: 1,
      legado_entrada_no_judicial: 1,
      legado_indeferimento_administrativo: 1,
      legado_agenda_visita: 1,
      legado_pericia_importada: 3,
      legado_pericia_cancelada: 1,
      legado_agenda_cadastro_unico: 1,
      legado_inss_indeferido_sem_data: 1,
    })
    expect(carga.eventos.every((e) => e.quem === 'sistema')).toBe(true)
    const doCliente = carga.eventos.find((e) => e.acao === 'legado_cliente_importado')!
    expect(doCliente).toMatchObject({ alvo: `pessoa:${carga.pessoas[0].id}`, quando: '2024-03-01T15:00:00.000Z', detalhe: { codigo: 'CLI-0001', fonte: 'juridico' } })
    const contrato = carga.eventos.find((e) => e.acao === 'legado_assinatura_de_contrato')!
    expect(contrato).toMatchObject({ alvo: `caso:${casoDe('p1').id}`, quando: '2024-03-01T15:00:00.000Z' })
    // Sem processo e com um caso só, a agenda do cliente vai ao caso; sem caso certo, à pessoa.
    expect(carga.eventos.find((e) => e.acao === 'legado_agenda_cadastro_unico')!.alvo).toBe(`caso:${casoDe('p5').id}`)
  })
})

describe('as peças: datas, benefício e fase', () => {
  it('diaDoLegado aceita ISO, ISO com hora e dd/mm/aaaa; recusa o dia que não existe e o ano fora da faixa', () => {
    expect(diaDoLegado('2024-02-29')).toBe('2024-02-29')
    expect(diaDoLegado('2024-02-29 10:00:00+00')).toBe('2024-02-29')
    expect(diaDoLegado('29/02/2024')).toBe('2024-02-29')
    expect(diaDoLegado('2023-02-29')).toBeNull()
    expect(diaDoLegado('1899-12-31')).toBeNull()
    expect(diaDoLegado('')).toBeNull()
    expect(diaDoLegado(null)).toBeNull()
  })

  it('momentoDoLegado guarda a hora que veio e, só com o dia, usa a hora padrão em Brasília', () => {
    expect(momentoDoLegado('2025-08-20 10:00:00+00')).toBe('2025-08-20T10:00:00.000Z')
    expect(momentoDoLegado('2025-08-20')).toBe('2025-08-20T15:00:00.000Z')
    expect(momentoDoLegado('2025-08-20', '00:00')).toBe('2025-08-20T03:00:00.000Z')
    expect(momentoDoLegado('x')).toBeNull()
  })

  it('beneficioDoLegado: o nome antigo, o rótulo do catálogo ou o código; o resto é "outro" com o nome para o relatório', () => {
    expect(beneficioDoLegado('LOAS Deficiente')).toEqual({ beneficio: 'bpc_loas_deficiente', desconhecido: null })
    expect(beneficioDoLegado('Aposentadoria por Contribuição')).toEqual({ beneficio: 'aposentadoria_tempo', desconhecido: null })
    expect(beneficioDoLegado('Pensão por Morte')).toEqual({ beneficio: 'pensao_morte', desconhecido: null })
    expect(beneficioDoLegado('bpc_loas_idoso')).toEqual({ beneficio: 'bpc_loas_idoso', desconhecido: null })
    expect(beneficioDoLegado('Revisão para Vida Toda')).toEqual({ beneficio: 'revisao_vida_toda', desconhecido: null })
    expect(beneficioDoLegado('Inventário')).toEqual({ beneficio: 'inventario', desconhecido: null })
    expect(beneficioDoLegado('Benefício que não existe')).toEqual({ beneficio: 'outro', desconhecido: 'Benefício que não existe' })
    expect(beneficioDoLegado(null)).toEqual({ beneficio: null, desconhecido: null })
  })

  it('faseDoProcesso: o status geral; sem ele, o resultado do benefício, a movimentação, a etapa, e por fim o CNJ', () => {
    const p = processo({})
    expect(faseDoProcesso(processo({ statusGeral: 'Fase de Execução' }), undefined, [])).toEqual({ fase: 'judicial', desfecho: 'procedente_total', deduzida: false })
    expect(faseDoProcesso(processo({ statusGeral: 'Extinto em Juízo' }), undefined, [])).toEqual({ fase: 'encerrado', desfecho: 'extinto_sem_merito', deduzida: false })
    expect(faseDoProcesso(p, { processoId: 'p0', nome: null, ordem: null, ativo: null, resultadoAdministrativo: 'Em Análise no INSS', dataIndeferimentoAdministrativo: null, resultadoJudicial: null, dataConcessao: null, dataIndeferimentoJudicial: null }, [])).toEqual({ fase: 'administrativa', desfecho: null, deduzida: true })
    const mov = (tipo: string, data: string) => ({ id: tipo, processoId: 'p0', tipo, data, statusAnterior: null, statusNovo: null, criadoEm: null })
    expect(faseDoProcesso(p, undefined, [mov('Protocolo judicial', '2024-01-01'), mov('Concessão do benefício', '2024-06-01')])).toEqual({ fase: 'encerrado', desfecho: 'procedente_total', deduzida: true })
    expect(faseDoProcesso(p, undefined, [mov('Concessão do benefício', '2024-06-01')])).toEqual({ fase: 'encerrado', desfecho: 'deferido', deduzida: true })
    expect(faseDoProcesso(processo({ etapaAtual: 'Judicial' }), undefined, [])).toEqual({ fase: 'judicial', desfecho: null, deduzida: true })
    expect(faseDoProcesso(processo({ numeroCnj: CNJ }), undefined, [])).toEqual({ fase: 'judicial', desfecho: null, deduzida: true })
    expect(faseDoProcesso(p, undefined, [])).toEqual({ fase: 'atendimento', desfecho: null, deduzida: true })
  })

  it('sem nome, o cliente não entra; o mesmo CPF em duas unidades vira uma pessoa com os processos das duas', () => {
    const legado = legadoDeTeste()
    legado.clientesDoBackup.push(cliente({ id: 'b6', nome: '   ', status: 'Aceito' }), cliente({ id: 'b7', nome: 'Outra Grafia Teste', cpf: '111.111.111-11', status: 'Aceito' }))
    legado.clientesDoJuridico.push(juridico({ id: 4, codigo: 'CLI-0004', nome: 'Ana L Teste', cpf: '52998224725', status: 'ACEITO' }))
    const carga = transformar(legado, AGORA)
    expect(carga.relatorio.clientes.campos.semNome).toBe(1)
    expect(carga.relatorio.clientes.unidosPorCpf).toBe(1)
    expect(carga.pessoas.filter((p) => p.cpf === '52998224725')).toHaveLength(1)
    expect(carga.pessoas.map((p) => p.nome)).toEqual(['Ana Lima Teste', 'Carla Dias Teste', 'Dora Souza Teste', 'Outra Grafia Teste'])
  })
})
