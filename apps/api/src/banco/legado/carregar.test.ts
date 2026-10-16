import { gerarDvCnj } from '@ggv/campos'
import { count, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../conexao.ts'
import { caso, configuracao, eventoAuditoria, identificadorCaso, kitDocumento, pericia, pessoa, processoAcervo, resultadoInss, usuario } from '../esquema.ts'
import { usuariosDeExemplo } from '../exemplo.ts'
import { arquivoSql, carregar, comandosDaCarga, CONFIRMACAO, ligarAcervo, literal, MSG_SEM_CONFIRMACAO, TABELAS_QUE_FICAM, tabelasParaLimpar } from './carregar.ts'
import { transformar, type Carga } from './transformar.ts'
import type { Legado } from './extrair.ts'

// Uma carga pequena, de dados inventados, pelo mesmo caminho da de verdade.
const CNJ = `0001234${gerarDvCnj('0001234', '2024', '4', '03', '6301')}20244036301`
const legado: Legado = {
  clientesDoJuridico: [],
  clientesDoBackup: [
    { id: 'b1', nome: "Ana D'Ávila Teste", cpf: '529.982.247-25', dataNascimento: null, status: 'Aceito', motivoNaoAceite: null, email: null, telefone1: null, telefone2: null, cep: null, endereco: null, bairro: null, cidade: null, uf: null, dataContrato: '2024-03-01', pessoasNaCasa: null, rendaFamiliar: null, drivePastaId: null, criadoEm: null },
  ],
  processos: [
    { id: 'p1', clienteId: 'b1', area: 'Previdenciário', etapaAtual: null, statusGeral: 'Processo em Curso Judicial', numeroCnj: CNJ, dataProtocoloJudicial: null, dataEntradaJudicial: null, vara: null, valorCausa: null, vias: null, criadoEm: null, atualizadoEm: null },
    { id: 'p2', clienteId: 'b1', area: 'Previdenciário', etapaAtual: null, statusGeral: 'Indeferido Administrativo', numeroCnj: null, dataProtocoloJudicial: null, dataEntradaJudicial: null, vara: null, valorCausa: null, vias: null, criadoEm: null, atualizadoEm: null },
  ],
  beneficios: [{ processoId: 'p1', nome: 'LOAS Deficiente', ordem: 1, ativo: true, resultadoAdministrativo: null, dataIndeferimentoAdministrativo: null, resultadoJudicial: null, dataConcessao: null, dataIndeferimentoJudicial: null }],
  requerimentos: [{ id: 'r1', processoId: 'p2', tipo: 'LOAS Idoso', numeroProtocolo: '987654321', der: '2024-05-05', etapa: 'Indeferido Administrativo', dataDecisao: '2024-07-07', criadoEm: null, atualizadoEm: null }],
  agenda: [{ id: 'a1', clienteId: 'b1', processoId: 'p1', tipo: 'Perícia Médica', data: '2025-02-02', dataHora: null, status: 'Deficiência Comprovada', local: null }],
  movimentacoes: [{ id: 'm1', processoId: 'p1', tipo: 'Entrada no judicial', data: '2024-10-10', statusAnterior: null, statusNovo: null, criadoEm: null }],
  captacoes: [],
}
const carga: Carga = transformar(legado, new Date('2026-10-16T12:00:00Z'))

describe('o SQL da carga', () => {
  it('escreve cada valor como literal seguro: aspas dobradas, jsonb, nulo e booleano', () => {
    expect(literal("D'Ávila")).toBe("'D''Ávila'")
    expect(literal(null)).toBe('NULL')
    expect(literal(true)).toBe('true')
    expect(literal(12)).toBe('12')
    expect(literal({ a: "x'y" })).toBe(`'{"a":"x''y"}'::jsonb`)
  })

  it('monta um insert por lote, com on conflict do nothing, na ordem das chaves estrangeiras', () => {
    const comandos = comandosDaCarga(carga, 1)
    expect(comandos.map((c) => c.tabela)).toEqual(['pessoa', 'caso', 'caso', 'identificador_caso', 'identificador_caso', 'resultado_inss', 'pericia', 'evento_auditoria', 'evento_auditoria', 'evento_auditoria', 'evento_auditoria', 'evento_auditoria'])
    expect(comandos[0].sql).toMatch(/^insert into public\.pessoa \(id, nome, cpf, .*\) values\n\('[0-9a-f-]{36}', 'Ana D''Ávila Teste', '52998224725'/)
    expect(comandos.every((c) => c.sql.endsWith('on conflict do nothing'))).toBe(true)
    expect(comandosDaCarga(carga).map((c) => c.linhas)).toEqual([1, 2, 2, 1, 1, 5])
  })

  it('o arquivo .sql é uma transação: limpeza, carga e a ligação do acervo', () => {
    const texto = arquivoSql(carga, ['caso', 'pessoa'])
    expect(texto.startsWith('begin;\n\ntruncate table public.caso, public.pessoa;')).toBe(true)
    expect(texto).toContain('on conflict do nothing;')
    expect(texto).toContain("update public.processo_acervo a set caso_id = i.caso_id")
    expect(texto.endsWith('commit;')).toBe(true)
  })
})

describe('a carga no banco', () => {
  let banco: Banco
  let fechar: () => Promise<void>
  const total = async (tabela: typeof pessoa | typeof caso | typeof usuario | typeof configuracao | typeof kitDocumento | typeof eventoAuditoria) =>
    (await banco.select({ n: count() }).from(tabela))[0].n
  beforeAll(async () => {
    ;({ banco, fechar } = await abrirBancoEmbutido(undefined, true))
  })
  afterAll(() => fechar())

  it('sem a confirmação, recusa antes de tocar no banco', async () => {
    const antes = await total(pessoa)
    expect(antes).toBeGreaterThan(0)
    await expect(carregar(banco, carga, {})).rejects.toThrow(MSG_SEM_CONFIRMACAO)
    expect(await total(pessoa)).toBe(antes)
  })

  it('a limpeza pega toda tabela de dados e deixa quem entra, a configuração e o que só cresce', async () => {
    const tabelas = await tabelasParaLimpar(banco)
    expect(tabelas).toEqual(expect.arrayContaining(['pessoa', 'caso', 'documento', 'tarefa', 'processo_acervo', 'perito', 'credencial_govbr']))
    for (const fica of TABELAS_QUE_FICAM) expect(tabelas).not.toContain(fica)
  })

  it('zera os exemplos, mantém os logins e grava a carga; o Raio-X que entrar depois liga ao caso pelo CNJ', async () => {
    const usuariosAntes = await total(usuario)
    const configuracaoAntes = await total(configuracao)
    const kitsAntes = await total(kitDocumento)
    const eventosAntes = await total(eventoAuditoria)
    expect(usuariosAntes).toBe(usuariosDeExemplo.length)

    const resumo = await carregar(banco, carga, { [CONFIRMACAO]: 'sim' })
    expect(resumo.enviadas).toEqual({ pessoa: 1, caso: 2, identificador_caso: 2, resultado_inss: 1, pericia: 1, evento_auditoria: 5 })
    expect(resumo.acervoLigado).toBe(0)
    expect(await total(usuario)).toBe(usuariosAntes)
    expect(await total(configuracao)).toBe(configuracaoAntes)
    expect(await total(kitDocumento)).toBe(kitsAntes)
    expect(await total(eventoAuditoria)).toBe(eventosAntes + 5)
    expect(await banco.select({ nome: pessoa.nome, cpf: pessoa.cpf, situacao: pessoa.situacao }).from(pessoa)).toEqual([{ nome: "Ana D'Ávila Teste", cpf: '52998224725', situacao: 'cliente' }])
    expect((await banco.select({ fase: caso.fase, beneficio: caso.beneficio }).from(caso).orderBy(caso.fase)).map((c) => c.fase)).toEqual(['administrativa', 'judicial'])
    expect((await banco.select({ tipo: identificadorCaso.tipo, valor: identificadorCaso.valor }).from(identificadorCaso).orderBy(identificadorCaso.tipo)).map((i) => `${i.tipo}:${i.valor}`)).toEqual([`cnj:${CNJ}`, 'protocolo_inss:987654321'])
    expect((await banco.select({ resultado: resultadoInss.resultado, data: resultadoInss.dataDecisao }).from(resultadoInss))[0]).toEqual({ resultado: 'indeferido', data: '2024-07-07' })
    const [p] = await banco.select({ tipo: pericia.tipo, resultado: pericia.resultado, compareceu: pericia.compareceu, documento: pericia.documento }).from(pericia)
    expect(p).toMatchObject({ tipo: 'medica', resultado: 'favoravel', compareceu: true })
    expect(p.documento).toMatchObject({ tipo: 'medica', marcacao: { data: '2025-02-02' } })

    // Rodar de novo: a limpeza zera e a carga entra igual; os eventos, que só crescem, não duplicam (mesmo id).
    await carregar(banco, carga, { [CONFIRMACAO]: 'sim' })
    expect(await total(pessoa)).toBe(1)
    expect(await total(caso)).toBe(2)
    expect(await total(eventoAuditoria)).toBe(eventosAntes + 5)

    // O acervo do Raio-X chega depois (a Sênior importa a planilha): a ligação pelo CNJ é um passo à parte.
    await banco.insert(processoAcervo).values([
      { numeroCnj: CNJ, fonte: 'raio_x', beneficio: 'bpc_loas_deficiente', desfecho: 'procedente_total' },
      { numeroCnj: '00009999920244036301', fonte: 'raio_x', beneficio: 'bpc_loas_deficiente', desfecho: 'improcedente' },
    ])
    expect(await ligarAcervo(banco)).toBe(1)
    const [ligado] = await banco.select({ casoId: processoAcervo.casoId }).from(processoAcervo).where(sql`${processoAcervo.numeroCnj} = ${CNJ}`)
    expect(ligado.casoId).toBe(carga.casos.find((c) => c.fase === 'judicial')!.id)
  })
})
