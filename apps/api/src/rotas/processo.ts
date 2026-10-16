// A página do processo lida do banco (GGVP-146, parte 5): o caso inteiro numa resposta, na visão do perfil da sessão.
// Status, datas, etapas, tarefas, documentos (tipo e nome, nunca o conteúdo), a perícia e o resultado dela vão para todo
// mundo do caso. O conteúdo médico (os documentos médicos com o CID e o parecer) só para quem vê dado de saúde, com o
// acesso registrado (LGPD); a peça em preparo só para o Jurídico; os valores da prestação de contas só para o Financeiro
// e a advogada do caso. O Financeiro e o Sócio não abrem o caso (`caso.ver`).
import { ProcessoDoCaso, ResumoDoCaso, pode, type Erro } from '@ggv/contratos'
import { and, asc, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import {
  acessoDadoSensivel,
  caso,
  credencialGovbr,
  documento,
  documentoMedico,
  etapa,
  exigencia,
  exigenciaItem,
  fichaRecepcao,
  identificadorCaso,
  parecerMedico,
  pericia,
  perito,
  pessoa,
  prazo,
  publicacao,
  tarefa,
  usuario,
} from '../banco/esquema.ts'
import { criarCasoMedico, dataDoLaudoNovo, documentosMedicosDoCaso } from '../fluxo/documentacao-medica.ts'
import { limitesDeCobranca } from '../fluxo/exigencia.ts'
import { estrategiaAtual } from './estrategia.ts'
import { valoresVisiveis } from './valores.ts'
import { exigir } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { linhaDoCaso } from './historico.ts'
import { TELA_DO_PASSO } from './inss.ts'
import { ORIGEM_DO_PASSO } from './pericia.ts'
import { NO_CATALOGO, UUID, horaEmBrasilia } from './recepcao.ts'
import { etapaAtualDoCaso } from '../../../web/src/regras/caso.ts'
import { esperaOInss, situacaoDaPericia } from '../../../web/src/regras/pericia.ts'
import { SISTEMA, type Pericia } from '../../../web/src/regras/periciaNoCaso.ts'

export const MSG_CASO_NAO_ENCONTRADO = 'Caso não encontrado.'

/** O setor dono de cada raia, como a página agrupa as tarefas. */
export const SETOR: Record<string, string> = {
  atendimento: 'Atendimento',
  atendimento_lider: 'Atendimento',
  documentacao: 'Documentação',
  advogada: 'Jurídico',
  senior: 'Jurídico',
  juridico_adm: 'Jurídico administrativo',
  financeiro: 'Financeiro',
  socio: 'Sócio',
}
const ETAPA_ABERTA = ['aberta', 'aguardando_externo']
const TAREFA_ABERTA = ['aberta', 'em_andamento', 'aguardando']
const EXIGENCIA_ABERTA = ['aberta', 'dilacao_pedida']
/** De quem é a espera, pela regra da tela: começa por "cliente", é o cliente; no D3, a Justiça; o resto, o INSS. */
const deQuemEspera = (e: { aguardando: string; diagrama: string }) => (/^cliente/i.test(e.aguardando) ? 'cliente' : e.diagrama.startsWith('D3') ? 'justica' : 'inss')
/** A palavra do tipo da perícia no título da tarefa dela ("Marcar perícia médica e avaliação social"). */
const NO_TITULO_DA_PERICIA = { medica: 'médica', social: 'social' } as const
/** A peça em preparo (as versões e o pacote da petição e da manifestação): só o Jurídico (`peticao.ver`). */
const daPeca = (tipo: string) => tipo === 'pacote_peticao' || tipo.endsWith('_versao')

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasProcesso(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  // GGVP-86 CA14 (Pedro, 14/10): os dados do processo dentro da tarefa, para quem vê o caso; só a identificação, sem saúde,
  // estratégia nem valores. A página inteira continua de quem abre o processo (GGVP-162).
  app.get<{ Params: { id: string } }>('/api/casos/:id/resumo', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    if (!UUID.test(casoId)) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const [c] = await banco.select({ caso, pessoa }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const ids = await banco.select().from(identificadorCaso).where(eq(identificadorCaso.casoId, casoId)).orderBy(desc(identificadorCaso.criadoEm))
    const numero = (tipo: string) => ids.find((i) => i.tipo === tipo)?.valor ?? null
    return ResumoDoCaso.parse({
      casoId,
      pessoa: { id: c.pessoa.id, nome: c.pessoa.nome, cpf: c.pessoa.cpf, telefone: c.pessoa.telefone },
      beneficio: c.caso.beneficio && (NO_CATALOGO[c.caso.beneficio] ?? c.caso.beneficio),
      fase: c.caso.fase,
      identificadores: { nb: numero('nb'), protocolo: numero('protocolo_inss'), cnj: numero('cnj') },
      vara: c.caso.vara,
    })
  })

  // GGVP-162: a página do processo é de quem abre o processo; o Atendimento e a Documentação leem o caso pela ficha.
  app.get<{ Params: { id: string } }>('/api/casos/:id/processo', { preHandler: exigir(banco, 'processo.abrir', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    if (!UUID.test(casoId)) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const [c] = await banco.select({ caso, pessoa }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const perfil = pedido.perfilAtivo
    const quem = pedido.usuario!.id
    const hoje = hojeEmBrasilia(agora())

    const ids = await banco.select().from(identificadorCaso).where(eq(identificadorCaso.casoId, casoId)).orderBy(desc(identificadorCaso.criadoEm))
    const numero = (tipo: string) => ids.find((i) => i.tipo === tipo)?.valor ?? null
    const etapas = await banco
      .select()
      .from(etapa)
      .where(and(eq(etapa.casoId, casoId), inArray(etapa.situacao, ETAPA_ABERTA)))
      .orderBy(asc(etapa.iniciadaEm))
    const tarefas = (
      await banco
        .select({ tarefa, responsavel: usuario.nome })
        .from(tarefa)
        .leftJoin(usuario, eq(tarefa.responsavelId, usuario.id))
        .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.situacao, TAREFA_ABERTA)))
        .orderBy(asc(tarefa.prazo), asc(tarefa.criadoEm))
    ).map(({ tarefa: t, responsavel }) => ({
      id: t.id,
      setor: (t.perfilDono && SETOR[t.perfilDono]) ?? 'Sem setor',
      titulo: t.titulo,
      responsavel,
      prazo: t.prazo,
      passo: t.passo,
      tela: t.passo && TELA_DO_PASSO[t.passo] ? TELA_DO_PASSO[t.passo](casoId) : null,
    }))

    const veSaude = pode(perfil, 'dado_saude.ver_detalhe')
    const documentos = (await banco.select().from(documento).where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm))).orderBy(desc(documento.criadoEm)))
      .filter((d) => !daPeca(d.tipo) || pode(perfil, 'peticao.ver'))
      .map((d) => ({
        id: d.id,
        tipo: d.tipo,
        nome: d.sensivel && !veSaude ? null : d.nomeOriginal,
        origem: d.origem,
        data: hojeEmBrasilia(d.criadoEm),
        sensivel: d.sensivel,
      }))

    // As perícias do caso, da mais nova à mais antiga. A que ainda não abriu na tela da perícia (sem o formato das telas) sai
    // pelas colunas.
    const todas = await banco
      .select({ pericia, perito: perito.nome, passo: etapa.passo })
      .from(pericia)
      .leftJoin(perito, eq(pericia.peritoId, perito.id))
      .leftJoin(etapa, eq(pericia.chamadaPorEtapaId, etapa.id))
      .where(eq(pericia.casoId, casoId))
      .orderBy(desc(pericia.criadoEm), desc(pericia.id))
    const naPagina = (p: (typeof todas)[number]) => {
      const doc = p.pericia.documento as Pericia | null
      const origem = doc?.origem ?? ORIGEM_DO_PASSO[p.passo ?? ''] ?? 'd2-necessidade'
      const quando = p.pericia.agendadaPara
      return {
        tipo: p.pericia.tipo as 'medica' | 'social',
        origem,
        situacao: situacaoDaPericia(
          doc ?? {
            liberadaEm: esperaOInss(origem) ? undefined : p.pericia.criadoEm.toISOString(),
            marcacao: quando ? { comparecimento: p.pericia.compareceu === null ? undefined : { compareceu: p.pericia.compareceu } } : undefined,
            resultado: p.pericia.resultado ? { registrado: true } : undefined,
          },
        ),
        marcada: doc?.marcacao
          ? { data: doc.marcacao.data, hora: doc.marcacao.hora, local: doc.marcacao.local || null }
          : quando
            ? { data: hojeEmBrasilia(quando), hora: horaEmBrasilia(quando), local: p.pericia.local }
            : null,
        // GGVP-158 P5.5: sem o documento das telas, a data na linha da perícia do juiz só pode ter vindo da publicação.
        marcadaPeloSistema: doc?.marcacao ? doc.marcacao.origem === 'juizo' && doc.marcacao.registradaPor === SISTEMA : origem === 'd3a-juiz' && quando !== null,
        perito: p.perito,
        resultado: p.pericia.resultado as 'favoravel' | 'desfavoravel' | null,
      }
    }
    const periciaDoCaso = todas[0] ? naPagina(todas[0]) : null
    // GGVP-158 P12.3 (GGVP-86 CA9): as abertas e a última com resultado. O responsável é quem tem a tarefa aberta da perícia
    // (a que cita o tipo, quando há duas), ou o setor dela; o prazo é a data marcada e, antes dela, o prazo da tarefa.
    const daPericia = tarefas.filter((t) => t.passo?.startsWith('DP.'))
    const pericias = [...todas.filter((p) => !p.pericia.resultado), ...todas.filter((p) => p.pericia.resultado).slice(0, 1)].map((p) => {
      const pp = naPagina(p)
      if (pp.resultado) return { ...pp, responsavel: null, prazo: null }
      const t = daPericia.find((x) => x.titulo.includes(NO_TITULO_DA_PERICIA[pp.tipo])) ?? daPericia[0]
      const m = pp.marcada
      return { ...pp, responsavel: t ? (t.responsavel ?? t.setor) : null, prazo: m && m.data >= hoje ? m.data : (t?.prazo ?? m?.data ?? null) }
    })

    const abertas = await banco
      .select()
      .from(exigencia)
      .where(and(eq(exigencia.casoId, casoId), inArray(exigencia.situacao, EXIGENCIA_ABERTA)))
      .orderBy(asc(exigencia.prazo))
    // Os itens por setor das exigências abertas (G21): o que cada setor deve e quem cumpriu, quando.
    const itens = abertas.length
      ? await banco
          .select({ item: exigenciaItem, cumpridoPor: usuario.nome })
          .from(exigenciaItem)
          .leftJoin(usuario, eq(exigenciaItem.cumpridoPor, usuario.id))
          .where(inArray(exigenciaItem.exigenciaId, abertas.map((x) => x.id)))
          .orderBy(asc(exigenciaItem.prazo), asc(exigenciaItem.descricao))
      : []
    const exigencias = abertas.map((x) => ({
      origem: x.origem,
      descricao: x.descricao,
      prazo: x.prazo,
      situacao: x.situacao,
      recebidaEm: x.recebidaEm,
      itens: itens
        .filter((i) => i.item.exigenciaId === x.id)
        .map(({ item: i, cumpridoPor }) => ({
          setor: SETOR[i.perfilResponsavel] ?? i.perfilResponsavel,
          descricao: i.descricao,
          situacao: i.situacao,
          cumpridoEm: i.cumpridoEm?.toISOString() ?? null,
          cumpridoPor,
        })),
    }))
    // G12: só o prazo do processo que ainda tem tarefa aberta ligada a ele. A exigência do juiz grava o mesmo prazo nas duas
    // tabelas: enquanto ela está aberta, ele aparece uma vez só, como a exigência; cumprida ou só de ciência, sai da página.
    const daExigencia = new Set(abertas.flatMap((x) => (x.publicacaoId ? [x.publicacaoId] : [])))
    const prazos = (
      await banco
        .select({ fim: prazo.fim, regra: prazo.regra, publicacaoId: prazo.publicacaoId })
        .from(prazo)
        .where(
          and(
            eq(prazo.casoId, casoId),
            gte(prazo.fim, hoje),
            inArray(
              prazo.id,
              banco
                .select({ id: tarefa.prazoProcessualId })
                .from(tarefa)
                .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.situacao, TAREFA_ABERTA))),
            ),
          ),
        )
        .orderBy(asc(prazo.fim))
    )
      .filter((z) => !z.publicacaoId || !daExigencia.has(z.publicacaoId))
      .map(({ fim, regra }) => ({ fim, regra }))
    const publicacoes = await banco
      .select({ data: publicacao.disponibilizadaEm, fonte: publicacao.fonte, classe: publicacao.classe })
      .from(publicacao)
      .where(eq(publicacao.casoId, casoId))
      .orderBy(desc(publicacao.disponibilizadaEm), desc(publicacao.criadoEm))

    const esperando = etapas.find((e) => e.aguardando)
    const [primeira] = tarefas
    const proximoPasso = primeira
      ? { oQue: primeira.titulo, setor: primeira.setor, prazo: primeira.prazo, tela: primeira.tela }
      : esperando
        ? { oQue: `Esperando: ${esperando.aguardando}`, setor: null, prazo: null, tela: null }
        : null


    let saude = null
    if (veSaude) {
      const medicos = await banco
        .select({ tipo: documentoMedico.tipo, emitidoEm: documentoMedico.dataEmissao, profissional: documentoMedico.profissional, cid: documentoMedico.cid })
        .from(documentoMedico)
        .innerJoin(documento, eq(documentoMedico.documentoId, documento.id))
        .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm)))
        .orderBy(asc(documentoMedico.dataEmissao))
      const [parecer] = await banco
        .select({ resultado: parecerMedico.resultado, confirmadoEm: parecerMedico.confirmadoEm })
        .from(parecerMedico)
        .where(eq(parecerMedico.casoId, casoId))
        .orderBy(desc(parecerMedico.criadoEm))
        .limit(1)
      saude = { documentos: medicos, parecer: parecer ? { resultado: parecer.resultado, confirmadoEm: parecer.confirmadoEm?.toISOString() ?? null } : null }
      if (medicos.length || parecer) await banco.insert(acessoDadoSensivel).values({ usuarioId: quem, perfil: perfil!, casoId, recurso: `processo:${casoId}`, quando: agora() })
    }

    const [ficha] = await banco.select({ documento: fichaRecepcao.documento }).from(fichaRecepcao).where(eq(fichaRecepcao.pessoaId, c.pessoa.id))
    const [cofre] = await banco.select({ id: credencialGovbr.id }).from(credencialGovbr).where(eq(credencialGovbr.pessoaId, c.pessoa.id))

    // GGVP-158 P12.2 (GGVP-86 CA8): a espera de fora com o prazo, quando há (o das tarefas do mesmo passo e, do cliente, o
    // das exigências abertas), e o lembrete pelo tipo de espera, com o limite da cobrança da Configuração (G15).
    const lim = await limitesDeCobranca(banco)
    const vezes = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
    const LEMBRETE = {
      inss: 'a vigília confere o Meu INSS todo dia útil',
      cliente: `cobrança: ${vezes(lim.limite, 'tentativa', 'tentativas')}, com ${vezes(lim.intervaloDias, 'dia', 'dias')} entre elas; depois, a Sênior`,
      justica: 'a vigília lê as publicações 3 vezes por dia',
    }
    const comEspera = etapas.map((e) => {
      const etapaNaPagina = { diagrama: e.diagrama, passo: e.passo, aguardando: e.aguardando, desde: e.iniciadaEm.toISOString() }
      if (!e.aguardando) return etapaNaPagina
      const quem = deQuemEspera({ aguardando: e.aguardando, diagrama: e.diagrama })
      const datas = [...tarefas.filter((t) => t.passo === e.passo).map((t) => t.prazo), ...(quem === 'cliente' ? abertas.map((x) => x.prazo) : [])]
      return { ...etapaNaPagina, prazo: datas.filter((d): d is string => !!d).sort()[0] ?? null, lembrete: LEMBRETE[quem] }
    })

    // GGVP-158 P12.1 (GGVP-86 CA5): o laudo novo pela mesma conta do parecer; só a data, sem conteúdo e sem a IA.
    const parecerGuardado = await criarCasoMedico(banco, agora).lerParte<{ registros?: unknown[] }>(casoId, 'parecer')
    const naoConferidos = (await documentosMedicosDoCaso(banco, { id: casoId, pessoaId: c.pessoa.id })).filter((d) => !d.conferidoEm)
    const laudoNovoEm = dataDoLaudoNovo(parecerGuardado?.registros?.length ?? 0, naoConferidos) ?? null

    // GGVP-158 P7.6: os valores que a regra de valores deixa o perfil ver; os outros não vêm.
    const visiveis = await valoresVisiveis(banco, casoId, perfil)
    return ProcessoDoCaso.parse({
      casoId,
      pessoa: { id: c.pessoa.id, nome: c.pessoa.nome, cpf: c.pessoa.cpf, nascimento: c.pessoa.dataNascimento },
      beneficio: c.caso.beneficio && (NO_CATALOGO[c.caso.beneficio] ?? c.caso.beneficio),
      fase: c.caso.fase,
      desfecho: c.caso.desfecho,
      etapaAtual: etapaAtualDoCaso(c.caso.fase, [...etapas.map((e) => e.passo), ...tarefas.map((t) => t.passo)], c.caso.desfecho),
      identificadores: { nb: numero('nb'), protocolo: numero('protocolo_inss'), cnj: numero('cnj') },
      vara: c.caso.vara,
      juiz: c.caso.juiz,
      // GGVP-158 P7.1: a estratégia é interna: só o Jurídico e os sócios.
      ...(pode(perfil, 'estudo.ver') && { estrategia: await estrategiaAtual(banco, casoId) }),
      ...(visiveis && 'causa' in visiveis && { valorDaCausa: visiveis.causa }),
      ...(visiveis && 'rendaPorPessoa' in visiveis && { rendaPorPessoa: visiveis.rendaPorPessoa }),
      senhaGovNoCofre: !!cofre,
      transcricoes: (ficha?.documento as { transcricoes?: number } | undefined)?.transcricoes ?? 0,
      etapas: comEspera,
      laudoNovoEm,
      linha: await linhaDoCaso(banco, casoId),
      documentos,
      tarefas,
      pericia: periciaDoCaso,
      pericias,
      exigencias,
      prazos,
      publicacoes,
      proximoPasso,
      // Os valores da prestação pela mesma regra de valores (GGVP-44 CA13, Mateus 14/10): o Financeiro, o Sócio e a Sênior,
      // esta enquanto o caso está na prestação de contas; a advogada, não.
      valores: visiveis && 'prestacao' in visiveis && visiveis.prestacao
        ? { versao: visiveis.prestacao.versao, recebido: visiveis.prestacao.recebido, honorarios: visiveis.prestacao.honorarios, cliente: visiveis.prestacao.repasse }
        : null,
      saude,
    })
  })
}
