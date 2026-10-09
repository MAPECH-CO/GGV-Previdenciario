// A Recepção no servidor (GGVP-125, bloco 1: o lead e a ficha). As rotas têm a forma da design.md da change ggvp-6 e as
// regras são as mesmas do servidor de exemplo do Pedro, importadas das telas (só as regras puras: busca, duplicidade,
// ficha de atendimento), rodando aqui com o perfil da sessão. A ficha fica em `ficha_recepcao`, no formato das telas; a
// pessoa, em `pessoa`, que o resto do portal usa.
// ponytail: as regras vêm de apps/web; mover para um pacote comum quando a ligação terminar.
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  dataParaIso,
  isoParaData,
  normalizarCep,
  normalizarCpf,
  normalizarData,
  normalizarTelefone,
  validarCep,
  validarCpf,
  validarEmail,
  validarNome,
  validarTelefone,
} from '@ggv/campos'
import { BuscaNoBalcao, ConsultaDeDuplicidade, EdicaoDaFicha, EnvioDaFichaDeAtendimento, NovoClienteDoBalcao, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, contratoRecepcao, credencialGovbr, fichaRecepcao, gravacaoRecepcao, pessoa, tarefaRecepcao, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import type { TarefasPorArea } from '../fluxo/tarefasPorArea.ts'
import { portaoDoContato } from './seguranca.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { BENEFICIOS, nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type {
  Agendamento,
  EdicaoFicha,
  EnvioDaFicha,
  EventoHistorico,
  Ficha,
  FichaResumo,
  Gravacao,
  Processo,
  RespostaNovoCliente,
  TarefaEncaminhada,
} from '../../../web/src/dados/tipos.ts'
import { buscar, emAberto, etapaDaFicha } from '../../../web/src/regras/busca.ts'
import { confirmada } from '../../../web/src/regras/confirmacao.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import { fichaComCpf, fichasParecidas } from '../../../web/src/regras/duplicidade.ts'
import { ROTULOS_DA_FICHA, camposEmBranco, envioValido, type CampoDaFicha } from '../../../web/src/regras/fichaAtendimento.ts'
import type { Contrato } from '../../../web/src/regras/contratoDoCaso.ts'
import { IDADE_MAXIMA } from '../../../web/src/regras/formularios.ts'

export const MSG_FICHA_NAO_ENCONTRADA = 'Ficha não encontrada.'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** A hora em Brasília, também no servidor em UTC: "14:32". */
export const horaEmBrasilia = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d)
export const MSG_DADOS_INVALIDOS = 'Dados da ficha inválidos.'
export const MSG_GANCHO_DE_TESTE = 'Simular a falha é só do teste: na homologação e na produção, não.'
/** Os ganchos de teste (`falhar: true`, que simula a falha do serviço) só fora da homologação e da produção (GGVP-96). */
export const aceitaGanchoDeTeste = (ambiente: Record<string, string | undefined>) => ambiente.AMBIENTE !== 'homologacao' && ambiente.AMBIENTE !== 'producao'
/** Quem preenche no tablet é o próprio cliente (GGVP-24). */
const CLIENTE_NO_TABLET = 'Cliente (tablet)'

/** Os benefícios do servidor no catálogo das telas, para os casos que nasceram por outro caminho. */
export const NO_CATALOGO: Record<string, string> = {
  bpc_loas_deficiente: 'loas-deficiente',
  bpc_loas_idoso: 'loas-idoso',
  aposentadoria_pcd: 'aposentadoria-pcd',
  aposentadoria_idade: 'aposentadoria-idade',
  aposentadoria_tempo: 'aposentadoria-contribuicao',
  aposentadoria_especial: 'aposentadoria-especial',
  aposentadoria_incapacidade_permanente: 'incapacidade-permanente',
  auxilio_incapacidade_temporaria: 'incapacidade-temporaria',
  auxilio_acidente: 'auxilio-acidente',
  pensao_morte: 'pensao-morte',
  salario_maternidade: 'salario-maternidade',
}
/** O benefício do catálogo das telas no catálogo do portal, para o caso que nasce no fechamento (bloco 4a). */
export const NO_SERVIDOR: Record<string, string> = Object.fromEntries(Object.entries(NO_CATALOGO).map(([servidor, telas]) => [telas, servidor]))

/** O contrato do caso guardado, com a etapa do processo que as telas mostram (bloco 4a). */
export type ContratoGuardado = { contrato: Contrato; processo: Processo }

const ETAPA: Record<string, string> = { atendimento: 'Atendimento', administrativa: 'Administrativa · INSS', judicial: 'Judicial', encerrado: 'Encerrado' }

/** Os campos que a ficha deixa editar, como o histórico os chama (os mesmos do servidor de exemplo). */
const ROTULOS: Record<keyof EdicaoFicha, string> = {
  nome: 'nome',
  cpf: 'CPF',
  nascimento: 'data de nascimento',
  telefone: 'telefone',
  email: 'e-mail',
  estadoCivil: 'estado civil',
  endereco: 'endereço',
  cidadeUf: 'cidade',
  cep: 'CEP',
  profissao: 'profissão',
  comoChegou: 'como chegou',
  contatoPreferido: 'contato preferido',
  contatoApoio: 'contato de apoio',
  observacoes: 'observações',
}

const juntar = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`)

/** Os valores da ficha que o histórico compara na ficha de atendimento (CA10), pelo campo da tela. */
function valoresAtuais(f: Ficha): Record<CampoDaFicha, string> {
  return {
    nome: f.nome,
    cpf: f.cpf ?? '',
    nascimento: f.nascimento ?? '',
    telefone: f.telefone,
    endereco: f.endereco ?? '',
    pessoasNaCasa: f.fichaAtendimento?.pessoasNaCasa?.toString() ?? '',
    beneficioInteresse: f.beneficioInteresse ?? '',
    ultimaAtividade: f.fichaAtendimento?.ultimaAtividade ?? '',
    semTrabalharDesde: f.fichaAtendimento?.semTrabalharDesde ?? '',
    pedidosAoInss: f.fichaAtendimento?.pedidosAoInss ?? '',
  }
}

type Opcoes = { banco: Banco; agora?: () => Date; tarefasPorArea?: TarefasPorArea }

/** O setor das pendências da Recepção (o campo `setor` de cada uma) por perfil. */
const SETOR_DA_RECEPCAO: Partial<Record<string, string>> = {
  atendimento: 'Atendimento',
  atendimento_lider: 'Atendimento',
  advogada: 'Jurídico',
  senior: 'Jurídico',
  juridico_adm: 'Jurídico',
}
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/**
 * O fichário da Recepção, comum aos blocos: ler e gravar as fichas, o histórico das telas e as tarefas da Recepção.
 * "Hoje" é o de Brasília, também no servidor em UTC.
 */
export function criarFichario(banco: Banco, agora: () => Date) {
  const hoje = () => hojeEmBrasilia(agora())
  const evento = (oQue: string, quem: string): EventoHistorico => ({ quando: agora().toISOString(), quem, oQue })

  async function nomeDe(pedido: FastifyRequest) {
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, pedido.usuario!.id))
    return u?.nome ?? 'Alguém do escritório'
  }

  /**
   * As fichas: o documento da Recepção ou, para quem nasceu por outro caminho, a ficha montada da pessoa. Os processos
   * vêm sempre dos casos do banco. ponytail: lê todas as pessoas; filtrar no banco quando o escritório crescer.
   */
  async function fichas(ids?: string[]): Promise<Ficha[]> {
    const pessoas = await banco.select().from(pessoa).where(ids ? inArray(pessoa.id, ids) : undefined)
    if (!pessoas.length) return []
    const deQuem = pessoas.map((p) => p.id)
    const docs = new Map((await banco.select().from(fichaRecepcao).where(inArray(fichaRecepcao.pessoaId, deQuem))).map((f) => [f.pessoaId, f.documento as Ficha]))
    const casos = await banco.select({ id: caso.id, pessoaId: caso.pessoaId, beneficio: caso.beneficio, fase: caso.fase }).from(caso).where(inArray(caso.pessoaId, deQuem))
    const contratos = new Map(
      (await banco.select().from(contratoRecepcao).where(inArray(contratoRecepcao.pessoaId, deQuem))).map((c) => [c.casoId, c.dados as ContratoGuardado]),
    )
    const noCofre = new Set((await banco.select({ pessoaId: credencialGovbr.pessoaId }).from(credencialGovbr).where(inArray(credencialGovbr.pessoaId, deQuem))).map((c) => c.pessoaId))
    return pessoas.map((p) => {
      // O caso da Recepção mostra a etapa do contrato enquanto está em atendimento; depois, a fase do portal.
      const processos: Processo[] = casos
        .filter((c) => c.pessoaId === p.id && (c.beneficio || contratos.has(c.id)))
        .map((c) => {
          const doContrato = contratos.get(c.id)?.processo
          const beneficio = doContrato?.beneficio ?? NO_CATALOGO[c.beneficio!] ?? c.beneficio!
          return doContrato && c.fase === 'atendimento' ? { ...doContrato, id: c.id, beneficio } : { id: c.id, beneficio, etapa: ETAPA[c.fase] ?? c.fase }
        })
      const doc = docs.get(p.id)
      // A senha que está no cofre do portal vale mais que a situação guardada na ficha (G9).
      if (doc) return { ...doc, processos, ...(noCofre.has(p.id) && doc.senhaGov.situacao !== 'no-cofre' && { senhaGov: { situacao: 'no-cofre' as const } }) }
      const [ano, mes] = p.criadoEm.toISOString().slice(0, 7).split('-')
      return {
        id: p.id,
        situacao: p.situacao === 'cliente' ? 'cliente' : 'lead',
        desde: `${mes}/${ano}`,
        nome: p.nome,
        cpf: p.cpf ?? undefined,
        nascimento: p.dataNascimento ?? undefined,
        telefone: p.telefone ?? '',
        email: p.email ?? undefined,
        endereco: p.logradouro ?? undefined,
        bairro: p.bairro ?? undefined,
        cidadeUf: p.cidade ? [p.cidade, p.uf].filter(Boolean).join(' / ') : undefined,
        cep: p.cep ?? undefined,
        comoChegou: p.origem ?? undefined,
        senhaGov: { situacao: noCofre.has(p.id) ? 'no-cofre' : 'sem-senha' },
        fichaAtendimentoPreenchida: false,
        processos,
        agendamentos: [],
        contatos: [],
        documentos: [],
        transcricoes: 0,
        historico: [],
        arquivos: [],
      }
    })
  }

  const resumo = (f: Ficha): FichaResumo => ({ id: f.id, nome: f.nome, situacao: f.situacao, etapa: etapaDaFicha(f, hoje()), telefone: f.telefone })

  /** Grava a ficha e o que o resto do portal lê da pessoa (sem senha: G9). A situação (lead, cliente) não muda aqui. */
  async function guardar(f: Ficha) {
    const [cidade, uf] = (f.cidadeUf ?? '').split('/').map((x) => x.trim())
    await banco
      .update(pessoa)
      .set({
        nome: f.nome,
        cpf: f.cpf ?? null,
        telefone: f.telefone || null,
        email: f.email ?? null,
        dataNascimento: f.nascimento ?? null,
        cep: f.cep ?? null,
        logradouro: f.endereco ?? null,
        bairro: f.bairro ?? null,
        cidade: cidade || null,
        uf: uf || null,
        origem: f.comoChegou ?? null,
        atualizadoEm: agora(),
      })
      .where(eq(pessoa.id, f.id))
    const { processos: _, ...documento } = f
    await banco
      .insert(fichaRecepcao)
      .values({ pessoaId: f.id, documento })
      .onConflictDoUpdate({ target: fichaRecepcao.pessoaId, set: { documento, atualizadoEm: agora() } })
  }

  /** Abre a tarefa uma vez por motivo: o id é o das telas ("preparar-<entrevista>"); a que já existe fica como está. */
  async function abrirTarefa(t: TarefaEncaminhada) {
    await banco.insert(tarefaRecepcao).values({ id: t.id, pessoaId: t.cliente!.id, setor: t.setor, dados: t }).onConflictDoNothing()
  }

  /** A tarefa que tem de estar aberta ("Definir benefício" depois de cada entrevista): a concluída volta a abrir. */
  async function garantirAberta(t: TarefaEncaminhada) {
    await banco
      .insert(tarefaRecepcao)
      .values({ id: t.id, pessoaId: t.cliente!.id, setor: t.setor, dados: t })
      .onConflictDoUpdate({ target: tarefaRecepcao.id, set: { dados: t, concluidaEm: null } })
  }

  /** O compromisso pelo id das telas: "<id da ficha>-ag-<n>". */
  async function acharAgendamento(id: string) {
    const fichaId = id.slice(0, 36)
    const ficha = UUID.test(fichaId) && id.startsWith(`${fichaId}-ag-`) ? (await fichas([fichaId]))[0] : undefined
    const agendamento = ficha?.agendamentos.find((a) => a.id === id)
    return ficha && agendamento ? { ficha, agendamento } : null
  }

  /** As gravações e conversas: todas, para quem vê dado de saúde; senão, só as que não são do Jurídico. */
  async function gravacoes(todas: boolean): Promise<Gravacao[]> {
    const linhas = await banco
      .select()
      .from(gravacaoRecepcao)
      .where(todas ? undefined : eq(gravacaoRecepcao.soJuridico, false))
      // Na ordem em que nasceram: a tela da entrevista lê a última.
      .orderBy(gravacaoRecepcao.criadoEm, gravacaoRecepcao.id)
    return linhas.map((l) => l.dados as Gravacao)
  }

  async function guardarGravacao(g: Gravacao) {
    await banco
      .insert(gravacaoRecepcao)
      .values({ id: g.id, pessoaId: g.fichaId, soJuridico: g.soJuridico, dados: g })
      .onConflictDoUpdate({ target: gravacaoRecepcao.id, set: { dados: g, soJuridico: g.soJuridico } })
  }

  /** A gravação, a ficha dela e o compromisso da entrevista. */
  async function acharGravacao(id: string) {
    const [linha] = await banco.select().from(gravacaoRecepcao).where(eq(gravacaoRecepcao.id, id))
    if (!linha) return null
    const gravacao = linha.dados as Gravacao
    const [ficha] = await fichas([linha.pessoaId])
    return ficha ? { gravacao, ficha, agendamento: ficha.agendamentos.find((a) => a.id === gravacao.agendamentoId) } : null
  }

  async function concluirTarefas(pessoaId: string, acao: string, id?: string) {
    await banco
      .update(tarefaRecepcao)
      .set({ concluidaEm: agora() })
      .where(
        and(
          eq(tarefaRecepcao.pessoaId, pessoaId),
          isNull(tarefaRecepcao.concluidaEm),
          id ? eq(tarefaRecepcao.id, id) : sql`${tarefaRecepcao.dados}->>'acao' = ${acao}`,
        ),
      )
  }

  /** As tarefas da Recepção, no formato das telas: as abertas de todos, ou todas as de uma pessoa (com as concluídas). */
  async function tarefas(pessoaId?: string): Promise<TarefaEncaminhada[]> {
    const linhas = await banco
      .select()
      .from(tarefaRecepcao)
      .where(pessoaId ? eq(tarefaRecepcao.pessoaId, pessoaId) : isNull(tarefaRecepcao.concluidaEm))
    return linhas.map((t) => ({ ...(t.dados as TarefaEncaminhada), ...(t.concluidaEm && { concluida: true }) }))
  }

  const quandoNaConfirmacao = (a: Agendamento) => `${a.data === hoje() ? 'hoje' : dataCurta(a.data, hoje())} às ${a.hora}`

  /** "Preparar entrevista" do Jurídico, uma só por entrevista (GGVP-21 CA3). A ficha de atendimento também chama. */
  async function abrirPreparacao(ficha: Ficha, a: Agendamento, quem: string): Promise<TarefaEncaminhada> {
    const id = `preparar-${a.id}`
    const [existente] = await banco.select().from(tarefaRecepcao).where(eq(tarefaRecepcao.id, id))
    if (existente) return existente.dados as TarefaEncaminhada
    const tarefa: TarefaEncaminhada = {
      id,
      codigo: 'D1.06',
      cliente: { id: ficha.id, nome: ficha.nome },
      acao: 'Preparar entrevista',
      detalhe: [nomeBeneficio(ficha.beneficioInteresse) || 'benefício a definir', `entrevista ${quandoNaConfirmacao(a)}`, 'ficha de atendimento preenchida'].join(' · '),
      prazo: a.data === hoje() ? `antes das ${a.hora}` : dataCurta(a.data, hoje()),
      href: `/entrevista/${a.id}/preparar`,
      setor: 'Jurídico',
    }
    await abrirTarefa(tarefa)
    ficha.historico.push(evento(`Mandou ao Jurídico: preparar a entrevista de ${quandoNaConfirmacao(a)}`, quem))
    return tarefa
  }

  return {
    hoje,
    evento,
    nomeDe,
    fichas,
    resumo,
    guardar,
    abrirTarefa,
    garantirAberta,
    concluirTarefas,
    tarefas,
    abrirPreparacao,
    quandoNaConfirmacao,
    acharAgendamento,
    gravacoes,
    guardarGravacao,
    acharGravacao,
  }
}

export function registrarRotasRecepcao(app: FastifyInstance, { banco, agora = () => new Date(), tarefasPorArea }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const { hoje, evento, nomeDe, fichas, resumo, guardar, concluirTarefas, tarefas, abrirPreparacao } = criarFichario(banco, agora)
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }

  // GGVP-147: as pendências abertas da Recepção entram nas tarefas do setor, pelo setor de cada uma.
  tarefasPorArea?.registrar(async (perfil) => {
    const setor = SETOR_DA_RECEPCAO[perfil]
    if (!setor) return []
    const linhas = await banco
      .select()
      .from(tarefaRecepcao)
      .where(and(eq(tarefaRecepcao.setor, setor), isNull(tarefaRecepcao.concluidaEm)))
    return linhas.map((l) => l.dados as TarefaEncaminhada)
  })

  // GGVP-16 CA1, CA2, CA5, CA10: busca por nome, CPF ou telefone, com a regra do balcão. O termo vem no corpo.
  app.post('/api/balcao/busca', ver, async (pedido, resposta) => {
    const entrada = BuscaNoBalcao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Escreva o que buscar.')
    return buscar(await fichas(), entrada.data.termo, hoje())
  })

  // GGVP-16 CA6, CA9: o bloco "Já existe?" do Novo cliente.
  app.post('/api/fichas/duplicidade', editar, async (pedido, resposta) => {
    const entrada = ConsultaDeDuplicidade.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, MSG_DADOS_INVALIDOS)
    const todas = await fichas()
    const comCpf = fichaComCpf(todas, entrada.data.cpf)
    return { comCpf: comCpf ? resumo(comCpf) : undefined, parecidas: fichasParecidas(todas, entrada.data).map(resumo) }
  })

  // GGVP-16 CA6, CA9, CA13: o lead nasce no balcão; CPF repetido nunca grava; parecida só com "É outra pessoa".
  app.post('/api/fichas', editar, async (pedido, resposta): Promise<RespostaNovoCliente | Erro> => {
    const entrada = NovoClienteDoBalcao.safeParse(pedido.body)
    const d = entrada.success ? entrada.data : null
    const valido =
      d &&
      validarNome(d.nome) &&
      validarTelefone(d.telefone) &&
      (!d.cpf || validarCpf(d.cpf)) &&
      (!d.email || validarEmail(d.email)) &&
      d.idade >= 0 &&
      d.idade <= IDADE_MAXIMA &&
      d.pretende.length >= 3 &&
      (d.comoChegou !== 'indicacao' || validarNome(d.indicadoPor))
    if (!valido) return negar(resposta, 400, MSG_DADOS_INVALIDOS)
    const todas = await fichas()
    const cpf = d.cpf ? normalizarCpf(d.cpf) : undefined
    const existente = fichaComCpf(todas, cpf)
    if (existente) return { resultado: 'ja-existe', id: existente.id }
    const parecidas = fichasParecidas(todas, d)
    if (parecidas.length > 0 && !d.outraPessoa) return { resultado: 'parecidas', fichas: parecidas.map(resumo) }

    const quem = await nomeDe(pedido)
    const [p] = await banco.insert(pessoa).values({ nome: d.nome, cpf: cpf ?? null, telefone: normalizarTelefone(d.telefone), situacao: 'lead' }).returning()
    const [ano, mes] = hoje().split('-')
    const ficha: Ficha = {
      id: p.id,
      situacao: 'lead',
      desde: `${mes}/${ano}`,
      nome: d.nome,
      cpf,
      idade: d.idade,
      telefone: normalizarTelefone(d.telefone),
      email: d.email,
      cidadeUf: d.cidadeUf,
      comoChegou: d.comoChegou,
      indicadoPor: d.indicadoPor,
      observacoes: d.observacao,
      beneficioInteresse: d.beneficioInteresse,
      resumo: ['lead', d.cidadeUf?.replace(' / ', '/')].filter(Boolean).join(' · '),
      senhaGov: { situacao: 'sem-senha' },
      fichaAtendimentoPreenchida: false,
      processos: [],
      agendamentos: [],
      // A anotação do primeiro contato vai para "Últimos contatos" (CA13).
      contatos: [{ data: hoje(), canal: 'Presencial (balcão)', texto: d.pretende }],
      documentos: [],
      arquivos: [],
      transcricoes: 0,
      historico: [
        evento(
          parecidas.length > 0
            ? `Criou a ficha no balcão (lead), confirmando que é outra pessoa que ${parecidas.map((f) => f.nome).join(' e ')}`
            : 'Criou a ficha no balcão (lead)',
          quem,
        ),
      ],
    }
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'ficha_criada', pedido, `pessoa:${p.id}`, { outraPessoa: parecidas.length > 0 })
    // O Drive fica de fora (GGVP-107): sem pastas para ligar.
    return { resultado: 'criada', id: p.id, pastas: [] }
  })

  app.get<{ Params: { id: string } }>('/api/fichas/:id', ver, async (pedido, resposta) => {
    const [f] = /^[0-9a-f-]{36}$/.test(pedido.params.id) ? await fichas([pedido.params.id]) : []
    return f ?? negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
  })

  // Editar a ficha: toda alteração entra no histórico com o que mudou; CPF de outra ficha não grava.
  app.patch<{ Params: { id: string } }>('/api/fichas/:id', editar, async (pedido, resposta) => {
    const entrada = EdicaoDaFicha.safeParse(pedido.body)
    const e = entrada.success ? entrada.data : null
    const valido =
      e &&
      validarNome(e.nome) &&
      validarTelefone(e.telefone) &&
      (!e.cpf || validarCpf(e.cpf)) &&
      (!e.nascimento || isoParaData(e.nascimento) !== null) &&
      (!e.cep || validarCep(e.cep)) &&
      (!e.email || validarEmail(e.email))
    if (!valido) return negar(resposta, 400, MSG_DADOS_INVALIDOS)
    const todas = await fichas()
    const ficha = todas.find((f) => f.id === pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const edicao: EdicaoFicha = { ...e, cpf: e.cpf ? normalizarCpf(e.cpf) : undefined, telefone: normalizarTelefone(e.telefone), cep: e.cep ? normalizarCep(e.cep) : undefined }
    const dono = fichaComCpf(todas, edicao.cpf)
    if (dono && dono.id !== ficha.id) return { erro: 'cpf-de-outra-ficha', nome: dono.nome }
    // GGVP-138 (GGVP-111 CA1): telefone e e-mail só mudam com o cliente verificado e em contrato novo.
    const semVerificacao = await portaoDoContato(banco, agora, pedido, ficha, edicao)
    if (semVerificacao) return negar(resposta, 400, semVerificacao)
    const mudou = (Object.keys(ROTULOS) as (keyof EdicaoFicha)[]).filter((campo) => (ficha[campo] ?? '') !== (edicao[campo] ?? ''))
    if (edicao.comoChegou !== 'indicacao') ficha.indicadoPor = undefined
    Object.assign(ficha, edicao)
    if (mudou.length > 0) ficha.historico.push(evento(`Alterou ${juntar(mudou.map((c) => ROTULOS[c]))}`, await nomeDe(pedido)))
    await guardar(ficha)
    if (mudou.length > 0) await historico(pedido.usuario!.id, 'ficha_alterada', pedido, `pessoa:${ficha.id}`, { campos: mudou })
    return { ficha }
  })

  // GGVP-24: a ficha de atendimento. Os dados pessoais vão para a ficha única e a triagem, com o que ficou em branco
  // (CA6); a data não muda depois (CA12); toda alteração no histórico (CA10). Sem senha: a do gov.br é do cofre (CA8, G9).
  app.put<{ Params: { id: string } }>('/api/fichas/:id/ficha-de-atendimento', editar, async (pedido, resposta) => {
    const entrada = EnvioDaFichaDeAtendimento.safeParse(pedido.body)
    const envio = entrada.success ? (entrada.data as EnvioDaFicha) : null
    if (!envio || !envioValido(envio, hoje()) || !BENEFICIOS.some((b) => b.id === envio.beneficioInteresse)) return negar(resposta, 400, MSG_DADOS_INVALIDOS)
    const todas = await fichas()
    const ficha = todas.find((f) => f.id === pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const dono = fichaComCpf(todas, envio.cpf)
    if (dono && dono.id !== ficha.id) return { erro: 'cpf-de-outra-ficha', nome: dono.nome }

    const antes = valoresAtuais(ficha)
    const primeira = ficha.fichaAtendimento === undefined
    Object.assign(ficha, {
      nome: envio.nome,
      cpf: normalizarCpf(envio.cpf),
      nascimento: dataParaIso(normalizarData(envio.nascimento)) ?? undefined,
      telefone: normalizarTelefone(envio.telefone),
      endereco: envio.endereco,
      beneficioInteresse: envio.beneficioInteresse,
      fichaAtendimentoPreenchida: true,
    })
    const triagem = {
      endereco: envio.endereco ?? '',
      pessoasNaCasa: envio.pessoasNaCasa?.toString() ?? '',
      ultimaAtividade: envio.ultimaAtividade ?? '',
      semTrabalharDesde: envio.semTrabalharDesde ?? '',
      pedidosAoInss: envio.pedidosAoInss ?? '',
    }
    ficha.fichaAtendimento = {
      data: ficha.fichaAtendimento?.data ?? hoje(),
      origem: envio.origem,
      modelo: envio.modelo,
      pessoasNaCasa: envio.pessoasNaCasa,
      ultimaAtividade: envio.ultimaAtividade,
      semTrabalharDesde: envio.semTrabalharDesde,
      pedidosAoInss: envio.pedidosAoInss,
      emBranco: camposEmBranco(triagem),
    }
    const quem = envio.origem === 'tablet' ? CLIENTE_NO_TABLET : await nomeDe(pedido)
    let mudou: CampoDaFicha[] = []
    if (primeira) {
      const de = envio.origem === 'tablet' ? 'tablet' : `papel ${envio.modelo ?? 'GGV'}, conferida`
      const branco = ficha.fichaAtendimento.emBranco
      ficha.historico.push(evento(`Salvou a ficha de atendimento (${de})${branco.length ? `; em branco: ${juntar(branco)}` : ''}`, quem))
    } else {
      const depois = valoresAtuais(ficha)
      mudou = (Object.keys(antes) as CampoDaFicha[]).filter((c) => antes[c] !== depois[c])
      if (mudou.length > 0) ficha.historico.push(evento(`Alterou na ficha de atendimento: ${juntar(mudou.map((c) => ROTULOS_DA_FICHA[c]))}`, quem))
    }
    await concluirTarefas(ficha.id, 'Preencher ficha')
    const entrevista = ficha.agendamentos.find((a) => a.oQue === 'Entrevista' && emAberto(a) && a.data >= hoje() && confirmada(a.confirmacao))
    if (entrevista) await abrirPreparacao(ficha, entrevista, await nomeDe(pedido))
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'ficha_atendimento_salva', pedido, `pessoa:${ficha.id}`, { primeira, campos: mudou, origem: envio.origem })
    return { ficha, tarefas: await tarefas(ficha.id) }
  })
}
