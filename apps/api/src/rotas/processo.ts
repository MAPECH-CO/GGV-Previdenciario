// A página do processo lida do banco (GGVP-146, parte 5): o caso inteiro numa resposta, na visão do perfil da sessão.
// Status, datas, etapas, tarefas, documentos (tipo e nome, nunca o conteúdo), a perícia e o resultado dela vão para todo
// mundo do caso. O conteúdo médico (os documentos médicos com o CID e o parecer) só para quem vê dado de saúde, com o
// acesso registrado (LGPD); a peça em preparo só para o Jurídico; os valores da prestação de contas só para o Financeiro
// e a advogada do caso. O Financeiro e o Sócio não abrem o caso (`caso.ver`).
import { ProcessoDoCaso, pode, type Erro } from '@ggv/contratos'
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
  fichaRecepcao,
  identificadorCaso,
  parecerMedico,
  pericia,
  perito,
  pessoa,
  prazo,
  prestacaoContas,
  publicacao,
  tarefa,
  usuario,
} from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { linhaDoCaso } from './historico.ts'
import { TELA_DO_PASSO } from './inss.ts'
import { ORIGEM_DO_PASSO } from './pericia.ts'
import { NO_CATALOGO, UUID, horaEmBrasilia } from './recepcao.ts'
import { etapaAtualDoCaso } from '../../../web/src/regras/caso.ts'
import { esperaOInss, situacaoDaPericia } from '../../../web/src/regras/pericia.ts'
import type { Pericia } from '../../../web/src/regras/periciaNoCaso.ts'

export const MSG_CASO_NAO_ENCONTRADO = 'Caso não encontrado.'

/** O setor dono de cada raia, como a página agrupa as tarefas. */
const SETOR: Record<string, string> = {
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
/** A peça em preparo (as versões e o pacote da petição e da manifestação): só o Jurídico (`peticao.ver`). */
const daPeca = (tipo: string) => tipo === 'pacote_peticao' || tipo.endsWith('_versao')

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasProcesso(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  app.get<{ Params: { id: string } }>('/api/casos/:id/processo', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
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

    // A perícia mais recente. A que ainda não abriu na tela da perícia (sem o formato das telas) sai pelas colunas.
    const [p] = await banco
      .select({ pericia, perito: perito.nome, passo: etapa.passo })
      .from(pericia)
      .leftJoin(perito, eq(pericia.peritoId, perito.id))
      .leftJoin(etapa, eq(pericia.chamadaPorEtapaId, etapa.id))
      .where(eq(pericia.casoId, casoId))
      .orderBy(desc(pericia.criadoEm), desc(pericia.id))
      .limit(1)
    let periciaDoCaso = null
    if (p) {
      const doc = p.pericia.documento as Pericia | null
      const origem = doc?.origem ?? ORIGEM_DO_PASSO[p.passo ?? ''] ?? 'd2-necessidade'
      const quando = p.pericia.agendadaPara
      periciaDoCaso = {
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
        perito: p.perito,
        resultado: p.pericia.resultado as 'favoravel' | 'desfavoravel' | null,
      }
    }

    const exigencias = await banco
      .select({ origem: exigencia.origem, descricao: exigencia.descricao, prazo: exigencia.prazo, situacao: exigencia.situacao })
      .from(exigencia)
      .where(and(eq(exigencia.casoId, casoId), inArray(exigencia.situacao, EXIGENCIA_ABERTA)))
      .orderBy(asc(exigencia.prazo))
    const prazos = await banco
      .select({ fim: prazo.fim, regra: prazo.regra })
      .from(prazo)
      .where(and(eq(prazo.casoId, casoId), gte(prazo.fim, hoje)))
      .orderBy(asc(prazo.fim))
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

    // Valores: o Financeiro e a advogada do caso (a que não foi definida ainda conta como a da prestação, como na rota dela).
    const daAdvogada = (c.caso.advogadaResponsavelId ?? quem) === quem
    const veValores = pode(perfil, 'valores.ver') || (pode(perfil, 'prestacao.ver') && daAdvogada)
    const [pc] = veValores ? await banco.select().from(prestacaoContas).where(eq(prestacaoContas.casoId, casoId)).orderBy(desc(prestacaoContas.versao)).limit(1) : []

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

    return ProcessoDoCaso.parse({
      casoId,
      pessoa: { id: c.pessoa.id, nome: c.pessoa.nome, cpf: c.pessoa.cpf, nascimento: c.pessoa.dataNascimento },
      beneficio: c.caso.beneficio && (NO_CATALOGO[c.caso.beneficio] ?? c.caso.beneficio),
      fase: c.caso.fase,
      desfecho: c.caso.desfecho,
      etapaAtual: etapaAtualDoCaso(c.caso.fase, [...etapas.map((e) => e.passo), ...tarefas.map((t) => t.passo)], c.caso.desfecho),
      identificadores: { nb: numero('nb'), protocolo: numero('protocolo_inss'), cnj: numero('cnj') },
      senhaGovNoCofre: !!cofre,
      transcricoes: (ficha?.documento as { transcricoes?: number } | undefined)?.transcricoes ?? 0,
      etapas: etapas.map((e) => ({ diagrama: e.diagrama, passo: e.passo, aguardando: e.aguardando, desde: e.iniciadaEm.toISOString() })),
      linha: await linhaDoCaso(banco, casoId),
      documentos,
      tarefas,
      pericia: periciaDoCaso,
      exigencias,
      prazos,
      publicacoes,
      proximoPasso,
      valores: pc ? { versao: pc.versao, recebido: pc.valorRecebido, honorarios: pc.honorarios, cliente: pc.valorCliente } : null,
      saude,
    })
  })
}
