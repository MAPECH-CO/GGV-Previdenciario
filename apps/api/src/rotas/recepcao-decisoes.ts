// As decisões depois da entrevista no servidor (GGVP-125, bloco 3b), sobre o fichário da Recepção: o cadastro do lead, a
// análise da ficha, a definição do benefício, o cálculo, o fechamento (G16), o recontato, a nova demanda e a situação da
// senha do gov.br. As regras são as do servidor de exemplo do Pedro (cadastro, beneficio, calculo, fechamento,
// novaDemanda, segundaFicha, cofre e renovacao), com as regras puras importadas das telas. A IA sugere e o Jurídico
// decide (G3); o papel de quem registra vem da sessão, nunca do pedido.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { dataParaIso, normalizarCpf, normalizarData } from '@ggv/campos'
import {
  AnaliseDaFicha,
  DecisaoDoBeneficio,
  EnvioDaDemanda,
  EnvioDoFechamento,
  PedidoDeCadastro,
  RegistroDoCalculo,
  RenovacaoDaSenha,
  ResultadoDoRecontato,
  SituacaoDaSenhaGov,
  type Erro,
  type Perfil,
} from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { credencialGovbr, pessoa } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { analisar, cnisDoCaso } from '../../../web/src/dados/acervo.ts'
import { BENEFICIOS, MOTIVOS_DE_NAO_FECHAR, nomeBeneficio, nomeMotivo } from '../../../web/src/dados/catalogos.ts'
import type { Agendamento, Calculo, Cadastro, Demanda, Ficha, PapelNoFechamento, Renovacao, TarefaEncaminhada } from '../../../web/src/dados/tipos.ts'
import { cadastroDaFicha, errosDoCadastro, errosDoRepresentante, fichaDoCadastro, mesclar, normalizarRg, ROTULOS_DO_CADASTRO } from '../../../web/src/regras/cadastro.ts'
import { calculoPendente, dataPrevistaIso, exigeCalculo, pontosFalados, registroValido, tempoFalado } from '../../../web/src/regras/calculo.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import { fichaComCpf } from '../../../web/src/regras/duplicidade.ts'
import { TAMANHO_DO_DETALHE, beneficioDoFechamento, motivoParadoDoFechamento, podeRegistrarOMotivo, recontatoEmAberto } from '../../../web/src/regras/fechamento.ts'
import { demandaAberta, motivoParadoDaDemanda } from '../../../web/src/regras/novaDemanda.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario } from './recepcao.ts'
import { MSG_ENTREVISTA_NAO_ENCONTRADA } from './recepcao-entrevista.ts'

export const MSG_SENHA_FORA_DO_COFRE = 'A senha ainda não está no cofre do portal.'
const JURIDICO: Perfil[] = ['advogada', 'senior', 'juridico_adm']

/** Quem registra o fechamento, pelo perfil da sessão (GGVP-60 CA11): a recusa do escritório não é do Atendimento. */
const papelDa = (perfil: string | null | undefined): PapelNoFechamento =>
  perfil === 'atendimento_lider' ? 'atendimento-senior' : JURIDICO.includes(perfil as Perfil) ? 'advogada-atendimento' : 'atendimento'

/** "Estado civil" → "estado civil"; sigla fica: "RG", "CEP". */
const minusculo = (rotulo: string) => (rotulo === rotulo.toUpperCase() ? rotulo : rotulo.charAt(0).toLowerCase() + rotulo.slice(1))
const dataIso = (data: string) => dataParaIso(normalizarData(data))
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

type Opcoes = { banco: Banco; agora?: () => Date }

export function registrarRotasRecepcaoDecisoes(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const f = criarFichario(banco, agora)
  const { hoje, evento, nomeDe, fichas, guardar, garantirAberta, concluirTarefas, tarefas, acharAgendamento } = f
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }
  const analisarFicha = { preHandler: exigir(banco, 'ficha.analisar', agora) }
  const cofre = { preHandler: exigir(banco, 'cofre.cadastrar', agora) }

  const fichaPeloId = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)
  const devolver = async (ficha: Ficha) => ({ ficha, tarefas: await tarefas(ficha.id) })
  const temSenhaNoCofre = async (pessoaId: string) =>
    (await banco.select({ id: credencialGovbr.id }).from(credencialGovbr).where(eq(credencialGovbr.pessoaId, pessoaId))).length > 0

  /** Uma pendência do Atendimento ligada à entrevista, com prazo no horário dela; a que já está aberta não repete. */
  async function pendenciaDoAtendimento(ficha: Ficha, a: Agendamento, t: Pick<TarefaEncaminhada, 'id' | 'codigo' | 'acao' | 'detalhe' | 'href'>) {
    const tarefa: TarefaEncaminhada = {
      ...t,
      cliente: { id: ficha.id, nome: ficha.nome },
      prazo: a.data === hoje() ? `até ${a.hora}` : `até ${dataCurta(a.data, hoje())} ${a.hora}`,
      urgente: a.data === hoje(),
      setor: 'Atendimento',
    }
    await garantirAberta(tarefa)
    return tarefa
  }

  /** G16 na pessoa do portal: o lead arquivado fica `nao_virou_cliente` com o motivo, e as tarefas abertas dele se encerram. */
  async function arquivar(ficha: Ficha, motivo: string, detalhe: string | undefined) {
    await banco
      .update(pessoa)
      .set({ situacao: 'nao_virou_cliente', motivoNaoVirou: `${nomeMotivo(motivo)}${detalhe ? `: ${detalhe}` : ''}`, atualizadoEm: agora() })
      .where(eq(pessoa.id, ficha.id))
    for (const t of await tarefas(ficha.id)) if (!t.concluida) await concluirTarefas(ficha.id, t.acao, t.id)
  }

  /** O compromisso "Recontatar lead" na agenda, no formato dos compromissos do servidor. */
  function marcarRecontato(ficha: Ficha, data: string, quem: string): string {
    const id = `${ficha.id}-ag-${randomUUID().slice(0, 8)}`
    ficha.agendamentos.push({ id, data, hora: '09:00', oQue: 'Recontatar lead', com: quem, tipo: 'telefone', duracao: 15 })
    return id
  }

  // GGVP-43: o cadastro completa a mesma ficha do primeiro contato (CA9); CPF de outra ficha não grava (CA2); mescla com
  // o que outra pessoa salvou (CA11); cada campo alterado vai ao histórico com o valor anterior (CA7).
  app.put<{ Params: { id: string } }>('/api/fichas/:id/cadastro', editar, async (pedido, resposta) => {
    const entrada = PedidoDeCadastro.safeParse(pedido.body)
    const p = entrada.success ? entrada.data : null
    if (!p || Object.keys(errosDoCadastro(p.valores, hoje())).length > 0 || (p.representante && Object.keys(errosDoRepresentante(p.representante)).length > 0))
      return negar(resposta, 400, 'Cadastro incompleto ou inválido.')
    const todas = await fichas()
    const ficha = todas.find((x) => x.id === pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const dono = fichaComCpf(todas, p.valores.cpf)
    if (dono && dono.id !== ficha.id) return { resultado: 'cpf-de-outra-ficha', id: dono.id, nome: dono.nome }

    // Compara na mesma forma: "12.345.678-9" digitado e "123456789" salvo são o mesmo RG.
    const forma = (c: Cadastro) => cadastroDaFicha({ ...ficha, ...fichaDoCadastro(c) })
    const atual = cadastroDaFicha(ficha)
    const meu = forma(p.valores)
    const { valores, conflitos } = mesclar(forma(p.base), meu, atual)
    if (conflitos.length > 0) return { resultado: 'conflito', campos: conflitos.map((campo) => ({ campo, deles: atual[campo], meu: meu[campo] })) }

    const quem = await nomeDe(pedido)
    const primeiraVez = !ficha.historico.some((e) => e.oQue.startsWith('Cadastrou o lead'))
    const antes = { ...atual, profissao: ficha.profissao ?? '', estadoCivil: ficha.estadoCivil ?? '' }
    Object.assign(ficha, fichaDoCadastro(valores))
    const depois = cadastroDaFicha(ficha)
    const registros = (Object.keys(ROTULOS_DO_CADASTRO) as (keyof Cadastro)[])
      .filter((c) => atual[c] !== depois[c])
      .map((c) => evento(`Alterou ${minusculo(ROTULOS_DO_CADASTRO[c])}: «${antes[c] || '—'}» → «${depois[c]}»`, quem))
    const representante = p.representante && { ...p.representante, cpf: normalizarCpf(p.representante.cpf), rg: normalizarRg(p.representante.rg) }
    if (JSON.stringify(representante) !== JSON.stringify(ficha.representante)) {
      const de = ficha.representante ? `${ficha.representante.nome} (${ficha.representante.parentesco})` : '—'
      const para = representante ? `${representante.nome} (${representante.parentesco})` : '—'
      registros.push(evento(`Alterou o representante legal: «${de}» → «${para}»`, quem))
      ficha.representante = representante
    }
    if (primeiraVez) registros.unshift(evento('Cadastrou o lead (D1.10): completou a mesma ficha do primeiro contato', quem))
    ficha.historico.push(...registros)
    await concluirTarefas(ficha.id, 'Cadastrar lead', `cadastrar-${ficha.id}`)
    await guardar(ficha)
    return { resultado: 'salvo', ...(await devolver(ficha)) }
  })

  // GGVP-28 CA1, CA4: "Pode ser auxílio acidentário?" fica na ficha com a autora; "Sim" abre "Preencher segunda ficha".
  // Sem senha no cofre, o Atendimento renova antes da entrevista (GGVP-36 CA1, CA4).
  app.post<{ Params: { id: string } }>('/api/entrevistas/:id/analise', analisarFicha, async (pedido, resposta) => {
    const entrada = AnaliseDaFicha.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Análise inválida.')
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_ENTREVISTA_NAO_ENCONTRADA)
    const { ficha, agendamento: a } = achado
    const { acidentario } = entrada.data
    const quem = await nomeDe(pedido)
    ficha.analise = { acidentario, quem, quando: agora().toISOString() }
    ficha.historico.push(evento(acidentario ? 'Analisou a ficha: pode ser auxílio acidentário' : 'Analisou a ficha: não é auxílio acidentário', quem))
    const abertas: TarefaEncaminhada[] = []
    if (acidentario && !ficha.segundaFicha)
      abertas.push(
        await pendenciaDoAtendimento(ficha, a, {
          id: `segunda-ficha-${a.id}`,
          codigo: 'D1.07',
          acao: 'Preencher segunda ficha',
          detalhe: 'FICHA DE ATENDIMENTO AUXILIO ACIDENTE em papel, preenchida pela cliente e escaneada antes da entrevista',
          href: `/clientes/${ficha.id}/segunda-ficha`,
        }),
      )
    if (ficha.senhaGov.situacao !== 'no-cofre')
      abertas.push(
        await pendenciaDoAtendimento(ficha, a, {
          id: `renovar-senha-${a.id}`,
          codigo: 'D1.08',
          acao: 'Renovar senha do gov.br',
          detalhe: 'com o cliente, antes da entrevista · a senha vai direto ao cofre',
          href: `/entrevista/${a.id}/renovar-senha`,
        }),
      )
    await guardar(ficha)
    return { abertas, ...(await devolver(ficha)) }
  })

  // GGVP-51: guarda o benefício final, quem decidiu, o citado, a sugestão e os casos consultados (CA6); recusar a
  // sugestão vai ao histórico (CA3); trocar substitui, com o anterior no histórico (CA8). Benefício com cálculo abre
  // "Calcular tempo e pontos" (GGVP-57).
  app.post<{ Params: { id: string } }>('/api/entrevistas/:id/beneficio', analisarFicha, async (pedido, resposta) => {
    const entrada = DecisaoDoBeneficio.safeParse(pedido.body)
    const d = entrada.success ? entrada.data : null
    if (!d || d.beneficio === 'nao-sei' || !BENEFICIOS.some((b) => b.id === d.beneficio))
      return negar(resposta, 400, 'Escolha o benefício e confira a recomendação com a entrevista.')
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_ENTREVISTA_NAO_ENCONTRADA)
    const { ficha, agendamento } = achado
    const gravacao = (await f.gravacoes(true)).filter((g) => g.agendamentoId === agendamento.id && g.transcricao === 'pronta').at(-1)
    const { sugestao } = analisar(ficha, gravacao, hoje())
    const quem = await nomeDe(pedido)
    const motivo = d.motivoDaRecusa || undefined
    const anterior = ficha.beneficioDefinido
    const recusou = sugestao !== undefined && d.beneficio !== sugestao.sugerido
    ficha.beneficioDefinido = {
      beneficio: d.beneficio,
      agendamentoId: agendamento.id,
      quem,
      quando: agora().toISOString(),
      citado: sugestao?.citado,
      sugerido: sugestao?.sugerido,
      fontes: sugestao?.base.map((c) => c.id) ?? [],
      recusouSugestao: recusou,
      ...(motivo && { motivoDaRecusa: motivo }),
    }
    if (anterior && anterior.beneficio !== d.beneficio)
      ficha.historico.push(evento(`Trocou o benefício do caso: «${nomeBeneficio(anterior.beneficio)}» → «${nomeBeneficio(d.beneficio)}»`, quem))
    const manteveOCitado = sugestao?.citado === d.beneficio
    ficha.historico.push(evento(`Definiu o benefício do caso (D1.12): ${nomeBeneficio(d.beneficio)}${manteveOCitado ? ' · o que citou na entrevista (G3)' : ''}`, quem))
    if (recusou) {
      const comMotivo = motivo ? `: ${motivo}` : ''
      ficha.historico.push(
        evento(
          manteveOCitado
            ? `Manteve o que citou na entrevista; a IA sugeria ${nomeBeneficio(sugestao.sugerido)} (G3)${comMotivo}`
            : `Recusou a sugestão da IA (${nomeBeneficio(sugestao.sugerido)})${comMotivo}`,
          quem,
        ),
      )
    }
    await concluirTarefas(ficha.id, 'Definir benefício', `definir-${ficha.id}`)
    // Benefício da lista "com cálculo": o advogado do atendimento calcula antes do fechamento; sem cálculo, a aberta sai.
    let tarefa: TarefaEncaminhada | undefined
    if (!exigeCalculo(d.beneficio)) await concluirTarefas(ficha.id, 'Calcular tempo e pontos', `calcular-${ficha.id}`)
    else {
      const cnis = cnisDoCaso(ficha.id)
      tarefa = {
        id: `calcular-${ficha.id}`,
        codigo: 'D1.13',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Calcular tempo e pontos',
        detalhe: [
          nomeBeneficio(d.beneficio),
          cnis ? `CNIS ${cnis.origem === 'meu-inss' ? 'do Meu INSS' : 'impresso'} de ${dataCurta(cnis.extraidoEm, hoje())}` : 'sem CNIS no caso',
          'obrigatório antes do fechamento',
        ].join(' · '),
        prazo: 'antes do fechamento',
        href: `/entrevista/${agendamento.id}/calculo`,
        setor: 'Atendimento',
      }
      await garantirAberta(tarefa)
    }
    await guardar(ficha)
    return { tarefa, ...(await devolver(ficha)) }
  })

  // GGVP-57: o advogado do atendimento registra o tempo, os pontos, a regra e quem conferiu (CA5); refazer guarda o
  // anterior (CA6). O portal não calcula sozinho e nenhum número vem da IA (G19).
  app.post<{ Params: { id: string } }>('/api/entrevistas/:id/calculo', analisarFicha, async (pedido, resposta) => {
    const entrada = RegistroDoCalculo.safeParse(pedido.body)
    if (!entrada.success || !registroValido(entrada.data, hoje())) return negar(resposta, 400, 'Cálculo incompleto ou inválido.')
    const registro = entrada.data
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_ENTREVISTA_NAO_ENCONTRADA)
    const { ficha } = achado
    if (!exigeCalculo(ficha.beneficioDefinido?.beneficio)) return negar(resposta, 400, 'O benefício deste caso não exige cálculo.')
    // ponytail: o CNIS ainda é o de exemplo; o anexado ao caso entra com os documentos (bloco 5).
    const cnis = cnisDoCaso(ficha.id)
    if (!cnis) return negar(resposta, 400, 'Sem CNIS no caso.')
    const quem = await nomeDe(pedido)
    const anterior = ficha.calculos?.at(-1)
    const calculo: Calculo = {
      tempo: registro.tempo,
      pontos: registro.pontos,
      regra: registro.regra,
      podeAposentar: registro.podeAposentar,
      ...(!registro.podeAposentar && { dataPrevista: dataPrevistaIso(registro.dataPrevista)! }),
      quem,
      quando: agora().toISOString(),
      cnisOrigem: cnis.origem,
      cnisExtraidoEm: cnis.extraidoEm,
    }
    const resumo = (c: Calculo) =>
      `${tempoFalado(c.tempo)}, ${pontosFalados(c.pontos)} pontos, ${c.regra}; ${c.podeAposentar ? 'já pode se aposentar' : `ainda não pode se aposentar: previsto para ${dataCurta(c.dataPrevista!, hoje())}`}`
    ficha.calculos = [...(ficha.calculos ?? []), calculo]
    ficha.historico.push(
      evento(
        anterior
          ? `Refez o cálculo de tempo e pontos (D1.13). Antes: ${resumo(anterior)}. Agora: ${resumo(calculo)}`
          : `Calculou tempo e pontos sobre o CNIS (D1.13): ${resumo(calculo)}`,
        quem,
      ),
    )
    await concluirTarefas(ficha.id, 'Calcular tempo e pontos', `calcular-${ficha.id}`)
    await guardar(ficha)
    return devolver(ficha)
  })

  // GGVP-60: "Fechou com o escritório?" é obrigatória (CA5). Não: o motivo da lista é obrigatório (CA1, CA6, G16), a recusa
  // do escritório não é do Atendimento (CA11); vale recontatar, a data vai à agenda (CA2, CA8); não vale, o lead é
  // arquivado com o motivo, na pessoa do portal, e sai das filas ativas (CA7). Fechou: o contrato segue nas telas até o
  // bloco 4. O cliente responde pela nova demanda (GGVP-124).
  app.post<{ Params: { id: string } }>('/api/fichas/:id/fechamento', editar, async (pedido, resposta) => {
    const entrada = EnvioDoFechamento.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Responda se fechou com o escritório.')
    const envio = entrada.data
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const papel = papelDa(pedido.perfilAtivo)
    const demanda = ficha.situacao === 'cliente' ? demandaAberta(ficha) : undefined
    if (ficha.situacao === 'cliente' && !demanda) return negar(resposta, 400, 'Não há nova demanda aberta.')
    if (demanda && !envio.fechou && envio.recontatar) return negar(resposta, 400, 'A nova demanda não tem recontato.')
    const beneficio = beneficioDoFechamento(ficha)
    const parado = motivoParadoDoFechamento(
      envio.fechou
        ? { fechou: true, motivo: '', detalhe: '', papel: 'atendimento', recontatar: false, data: '', beneficio, calculoPendente: !demanda && calculoPendente(ficha) }
        : {
            fechou: false,
            motivo: MOTIVOS_DE_NAO_FECHAR.some((m) => m.id === envio.motivo) ? envio.motivo : '',
            detalhe: envio.detalhe ?? '',
            papel,
            recontatar: envio.recontatar !== null,
            data: envio.recontatar?.data ?? '',
            beneficio,
          },
      hoje(),
    )
    if (parado) return negar(resposta, 400, parado)
    const quem = await nomeDe(pedido)
    const quando = agora().toISOString()
    if (envio.fechou) {
      if (demanda) demanda.situacao = 'fechou'
      else ficha.fechamento = { situacao: 'fechou', papel: 'atendimento', quem, quando }
      await guardar(ficha)
      return { fechou: true, beneficio, ...(await devolver(ficha)) }
    }
    const detalhe = envio.detalhe || undefined
    const motivo = nomeMotivo(envio.motivo)
    const comDetalhe = `${motivo}${detalhe ? ` (${detalhe})` : ''}`
    if (demanda) {
      Object.assign(demanda, { situacao: 'nao-fechou', motivo: envio.motivo, ...(detalhe && { detalhe }) })
      ficha.historico.push(evento(`Nova demanda não fechou: ${comDetalhe}. Segue cliente nos outros processos (G16)`, quem))
    } else if (envio.recontatar) {
      const em = dataIso(envio.recontatar.data)!
      ficha.fechamento = {
        situacao: 'recontatar',
        motivo: envio.motivo,
        ...(detalhe && { detalhe }),
        ...(envio.recontatar.espera && { espera: envio.recontatar.espera }),
        recontatarEm: em,
        recontatoId: marcarRecontato(ficha, em, quem),
        papel,
        quem,
        quando,
      }
      ficha.historico.push(evento(`Não fechou: ${comDetalhe}. Recontatar em ${dataCurta(em, hoje())}`, quem))
    } else {
      ficha.fechamento = { situacao: 'arquivado', motivo: envio.motivo, ...(detalhe && { detalhe }), papel, quem, quando }
      await arquivar(ficha, envio.motivo, detalhe)
      ficha.historico.push(evento(`Não fechou: ${comDetalhe}. Lead arquivado com o motivo (G16)`, quem))
    }
    await guardar(ficha)
    return { fechou: false, ...(await devolver(ficha)) }
  })

  // GGVP-60 CA10: o resultado do recontato. O caso volta ao cálculo, ganha uma nova data ou é arquivado com o motivo.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/recontato', editar, async (pedido, resposta) => {
    const entrada = ResultadoDoRecontato.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Resultado do recontato inválido.')
    const r = entrada.data
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const fechamento = ficha.fechamento
    if (fechamento?.situacao !== 'recontatar') return negar(resposta, 400, 'Não há recontato marcado.')
    const quem = await nomeDe(pedido)
    const quando = agora().toISOString()
    const feito = recontatoEmAberto(ficha)
    if (r.resultado === 'nova-data') {
      const em = dataIso(r.data)
      if (!em || em < hoje()) return negar(resposta, 400, 'Data do recontato inválida.')
      if (feito) feito.estado = 'remarcado'
      ficha.fechamento = { ...fechamento, recontatarEm: em, ...(r.espera && { espera: r.espera }), recontatoId: marcarRecontato(ficha, em, quem), quem, quando }
      ficha.contatos.push({ data: hoje(), canal: 'Recontato', texto: `Ainda não quer seguir; novo recontato em ${dataCurta(em, hoje())}.` })
      ficha.historico.push(evento(`Recontatou: nova data em ${dataCurta(em, hoje())}`, quem))
    } else if (r.resultado === 'calculo') {
      if (feito) feito.estado = 'realizado'
      ficha.fechamento = { ...fechamento, situacao: 'recalcular', quem, quando }
      ficha.contatos.push({ data: hoje(), canal: 'Recontato', texto: 'Quer seguir: o caso volta ao cálculo de tempo e pontos.' })
      ficha.historico.push(evento('Recontatou: o caso volta ao cálculo de tempo e pontos (D1.13)', quem))
    } else {
      const papel = papelDa(pedido.perfilAtivo)
      const detalhe = r.detalhe || undefined
      if (!MOTIVOS_DE_NAO_FECHAR.some((m) => m.id === r.motivo) || !podeRegistrarOMotivo(r.motivo, papel) || (detalhe?.length ?? 0) > TAMANHO_DO_DETALHE)
        return negar(resposta, 400, 'Motivo inválido.')
      if (feito) feito.estado = 'realizado'
      ficha.fechamento = { situacao: 'arquivado', motivo: r.motivo, ...(detalhe && { detalhe }), papel, quem, quando }
      await arquivar(ficha, r.motivo, detalhe)
      ficha.contatos.push({ data: hoje(), canal: 'Recontato', texto: `Não vai seguir: ${nomeMotivo(r.motivo)}.` })
      ficha.historico.push(evento(`Recontatou e arquivou o lead: ${nomeMotivo(r.motivo)}${detalhe ? ` (${detalhe})` : ''} (G16)`, quem))
    }
    await guardar(ficha)
    return devolver(ficha)
  })

  // GGVP-124: a nova demanda de quem já é cliente nasce na mesma ficha (CA1); recurso e defesa seguem no mesmo processo
  // (CA8). Aberta pelo Jurídico, o Atendimento liga para o cliente (CA9).
  app.post<{ Params: { id: string } }>('/api/fichas/:id/demandas', editar, async (pedido, resposta) => {
    const entrada = EnvioDaDemanda.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Nova demanda inválida.')
    const envio = entrada.data
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const beneficio = BENEFICIOS.some((b) => b.id === envio.beneficio) ? envio.beneficio : ''
    const parado = motivoParadoDaDemanda({ tipo: envio.tipo, pretende: envio.pretende, beneficio }, ficha)
    if (parado || envio.tipo === 'recurso-ou-defesa') return negar(resposta, 400, parado ?? 'Recurso e defesa seguem no mesmo processo.')
    const abertaPor: Demanda['abertaPor'] = JURIDICO.includes(pedido.perfilAtivo as Perfil) ? 'advogada' : 'atendimento'
    const quem = await nomeDe(pedido)
    const demanda: Demanda = {
      id: `demanda-${ficha.id}-${randomUUID().slice(0, 8)}`,
      pretende: envio.pretende,
      beneficio,
      tipo: envio.tipo,
      abertaPor,
      data: hoje(),
      quem,
      situacao: 'aberta',
    }
    ficha.demandas = [...(ficha.demandas ?? []), demanda]
    ficha.beneficioInteresse = beneficio
    const tipo = demanda.tipo === 'outro-pedido' ? 'outro pedido' : 'tentar de novo depois de perder'
    ficha.historico.push(evento(`Nova demanda (${tipo}): ${demanda.pretende} · ${nomeBeneficio(beneficio)}. Na mesma ficha, sem cadastro novo`, quem))
    await guardar(ficha)
    return { demanda, ...(await devolver(ficha)) }
  })

  // GGVP-24 e GGVP-103: a situação da senha do gov.br na ficha. A senha vai ao cofre do portal antes, pela rota do cofre;
  // aqui fica só quem e quando (G9). "Guardou" e "conferiu" pedem a senha que já está no cofre.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/cofre/gov', cofre, async (pedido, resposta) => {
    const entrada = SituacaoDaSenhaGov.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Situação da senha inválida.')
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const { acao } = entrada.data
    const quem = await nomeDe(pedido)
    if (acao === 'nao-sabe') {
      ficha.senhaGov = { situacao: 'sem-senha', naoSabe: true }
      ficha.historico.push(evento('Marcou "não sei a senha do gov.br": o caso segue com o alerta de senha', quem))
    } else {
      if (!(await temSenhaNoCofre(ficha.id))) return negar(resposta, 400, MSG_SENHA_FORA_DO_COFRE)
      ficha.senhaGov = { situacao: 'no-cofre', atualizadaEm: agora().toISOString(), por: quem }
      ficha.historico.push(
        evento(acao === 'guardou' ? 'Guardou a senha do gov.br no cofre' : 'Conferiu com o papel a senha do gov.br que a IA leu; ela fica no cofre', quem),
      )
    }
    await guardar(ficha)
    return { senhaGov: ficha.senhaGov, ficha }
  })

  // GGVP-36: "Renovou": a senha nova já foi ao cofre do portal, com a data em que funcionou (CA2, CA5, CA9, CA11); "Não
  // conseguiu": motivo e aviso ao cliente, em "Últimos contatos" (CA3, CA6). A entrevista segue nos dois.
  app.post<{ Params: { id: string } }>('/api/entrevistas/:id/renovacao', cofre, async (pedido, resposta) => {
    const entrada = RenovacaoDaSenha.safeParse(pedido.body)
    if (!entrada.success || (entrada.data.resultado === 'nao-conseguiu' && entrada.data.motivo.length < 3)) return negar(resposta, 400, 'Renovação inválida.')
    const r = entrada.data
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_ENTREVISTA_NAO_ENCONTRADA)
    const { ficha } = achado
    const quem = await nomeDe(pedido)
    const quando = agora().toISOString()
    let renovacao: Renovacao
    if (r.resultado === 'renovou') {
      if (!(await temSenhaNoCofre(ficha.id))) return negar(resposta, 400, MSG_SENHA_FORA_DO_COFRE)
      ficha.senhaGov = { situacao: 'no-cofre', atualizadaEm: quando, por: quem, funcionouEm: hoje() }
      renovacao = { resultado: 'renovou', quem, quando }
      ficha.historico.push(evento('Renovou a senha do gov.br e guardou no cofre; conferiu que o Meu INSS abre e que o CNIS aparece', quem))
    } else {
      renovacao = { resultado: 'nao-conseguiu', motivo: r.motivo, quem, quando }
      ficha.contatos.push({
        data: hoje(),
        canal: 'Aviso',
        texto: 'Avisado de que precisa recuperar a senha do gov.br, se preciso numa agência do INSS. A entrevista segue no horário marcado.',
      })
      ficha.historico.push(evento(`Não conseguiu renovar a senha do gov.br: ${r.motivo}. Avisou o cliente; a entrevista segue`, quem))
    }
    ficha.renovacao = renovacao
    await concluirTarefas(ficha.id, 'Renovar senha do gov.br')
    await guardar(ficha)
    return { senhaGov: ficha.senhaGov, renovacao, ...(await devolver(ficha)) }
  })
}
