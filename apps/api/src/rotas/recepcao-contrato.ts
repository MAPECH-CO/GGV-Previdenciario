// O contrato do caso no servidor (GGVP-125, bloco 4), sobre o fichário da Recepção. O "fechou" cria o caso em `caso`
// (o elo com o resto do portal) e o contrato com o kit; as condições do kit, a geração pelo modelo e a assinatura seguem as
// regras do servidor de exemplo do Pedro (contrato.ts), com as regras puras importadas das telas; a leitura, a conferência e a
// cópia também. O kit gerado é o Word do escritório, preenchido (GGVP-136). ZapSign, impressora, scanner e a leitura da IA
// seguem simulados.
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { dataParaIso, normalizarData, normalizarNome } from '@ggv/campos'
import {
  CondicoesDoKit,
  EntregaDaCopia,
  EnvioDoContrato,
  FechamentoDoCaso,
  MensagemEnviada,
  TIPO_DO_DOCX,
  TentativaDoContrato,
  VerificacaoDoContrato,
  VisitaDaCopia,
  type Erro,
} from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, contratoRecepcao, documento, pessoa } from '../banco/esquema.ts'
import { lerModelo, preencherModelo } from '../kit/docx.ts'
import { modeloEmVigor } from '../kit/modelos.ts'
import { exigir } from '../sessao/rotas.ts'
import { BENEFICIOS, nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type { Agendamento, Arquivo, Processo } from '../../../web/src/dados/tipos.ts'
import {
  CONFERENCIAS,
  NOMES_DOS_CANAIS,
  SEM_CONDICOES,
  TENTATIVAS_DE_ASSINATURA,
  cobrancaDaAssinatura,
  datasDoKit,
  entrevistaDoCaso,
  erroDoCampo,
  errosDaVisita,
  faltando,
  identificadorDoKit,
  identificadorDoModelo,
  kitRepresentado,
  linhaDoBeneficio,
  mensagemDoLink,
  modeloDoKit,
  montarKit,
  motivoParadoDaEntrega,
  motivoParadoDaVerificacao,
  normalizarCampo,
  papelNaHora,
  precisaConferir,
  resumoDaLeitura,
  ROTULOS_DOS_CAMPOS,
  type CampoDoModelo,
  type DadosDoContrato,
} from '../../../web/src/regras/contrato.ts'
import {
  ROTULOS_DAS_CONDICOES,
  camposDoCaso,
  dadosDoCaso,
  daFicha,
  juntar,
  leituraDeExemploDoContrato,
  linkDoZapSign,
  visitaDaCopia,
  type Assinatura,
  type Contrato,
  type ContratoDoCaso,
} from '../../../web/src/regras/contratoDoCaso.ts'
import { problemaDoArquivo } from '../../../web/src/regras/arquivos.ts'
import { faltamNoKit, valoresDoKit } from '../../../web/src/regras/kitDoModelo.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { fichaComCpf } from '../../../web/src/regras/duplicidade.ts'
import { guardarArquivo } from './formulario.ts'
import { MSG_FICHA_NAO_ENCONTRADA, NO_SERVIDOR, UUID, criarFichario, type ContratoGuardado } from './recepcao.ts'

export const MSG_CONTRATO_NAO_ENCONTRADO = 'Contrato não encontrado.'
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }

export function registrarRotasRecepcaoContrato(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const { hoje, evento, nomeDe, fichas, guardar, abrirTarefa, concluirTarefas, tarefas } = criarFichario(banco, agora)
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }
  // D1.16 a D1.20: o contrato é da raia do Atendimento; o % de honorários aparece só nele (GGVP-96).
  const conduzir = { preHandler: exigir(banco, 'contrato.conduzir', agora) }

  const fichaPeloId = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)

  const guardarContrato = (pessoaId: string, g: ContratoGuardado) =>
    banco
      .insert(contratoRecepcao)
      .values({ casoId: g.contrato.processoId, pessoaId, dados: g })
      .onConflictDoUpdate({ target: contratoRecepcao.casoId, set: { dados: g, atualizadoEm: agora() } })

  /** O contrato do caso, a ficha e o processo, como as telas os leem. */
  async function acharContrato(processoId: string): Promise<ContratoDoCaso | null> {
    if (!UUID.test(processoId)) return null
    const [linha] = await banco.select().from(contratoRecepcao).where(eq(contratoRecepcao.casoId, processoId))
    if (!linha) return null
    const g = linha.dados as ContratoGuardado
    const [ficha] = await fichas([linha.pessoaId])
    return ficha ? { ficha, processo: g.processo, contrato: g.contrato } : null
  }

  const quem = (pedido: FastifyRequest) => nomeDe(pedido)

  /** Assinado, o contrato segue para a leitura da Documentação (GGVP-81). */
  const assinado = (processo: Processo): Processo => ({ ...processo, etapa: `Contrato assinado em ${dataCurta(hoje(), hoje())}`, proximaAcao: 'ler e arquivar o contrato assinado' })

  /** Por que o contrato não vai ao papel na hora: só na entrevista presencial e sem documento no ZapSign (GGVP-77 CA4). */
  function semPapel({ ficha, contrato }: ContratoDoCaso): string | null {
    if (contrato.etapa !== 'assinatura' || !contrato.kit) return 'Este contrato não está para assinar.'
    if (!papelNaHora(entrevistaDoCaso(ficha.agendamentos))) return 'Papel só na entrevista presencial: a assinatura vai pelo ZapSign.'
    if (contrato.assinatura?.zapsign) return 'O documento já foi para o ZapSign.'
    return null
  }
  const noPapel = (contrato: Contrato): Assinatura => (contrato.assinatura = { ...(contrato.assinatura ?? { tentativas: [] }), forma: 'papel' })

  /** O contrato na etapa da cópia (GGVP-89), ou o motivo da recusa. */
  async function paraACopia(id: string): Promise<ContratoDoCaso | { status: number; erro: string }> {
    const achado = await acharContrato(id)
    if (!achado) return { status: 404, erro: MSG_CONTRATO_NAO_ENCONTRADO }
    if (achado.contrato.etapa !== 'copia') return { status: 400, erro: 'Este contrato não está para entregar a cópia.' }
    return achado
  }

  // GGVP-65 CA1, CA9: o cliente fechou. O caso nasce no banco do portal (fase atendimento), com o contrato e o kit do
  // benefício; o lead vira cliente na ficha e na pessoa; o Atendimento recebe "Preparar contrato". Quem já é cliente e
  // fecha outro benefício ganha caso e kit novos. Chamado pelo fechamento e pela nova demanda.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/processos', editar, async (pedido, resposta) => {
    const entrada = FechamentoDoCaso.safeParse(pedido.body)
    const beneficio = entrada.success ? entrada.data.beneficio : ''
    if (beneficio === 'nao-sei' || !BENEFICIOS.some((b) => b.id === beneficio)) return negar(resposta, 400, 'Benefício fora do catálogo.')
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const dia = hoje()
    if (ficha.situacao === 'lead') {
      ficha.situacao = 'cliente'
      ficha.desde = `${dia.slice(5, 7)}/${dia.slice(0, 4)}`
    }
    const [novo] = await banco.insert(caso).values({ pessoaId: ficha.id, beneficio: NO_SERVIDOR[beneficio] ?? null, fase: 'atendimento' }).returning()
    await banco.update(pessoa).set({ situacao: 'cliente', motivoNaoVirou: null, atualizadoEm: agora() }).where(eq(pessoa.id, ficha.id))
    // "Tem representante legal" do cadastro do lead (GGVP-43) já marca o LOAS representado; a pessoa confere no preparo.
    const condicoes = { ...SEM_CONDICOES, representado: Boolean(ficha.representante?.nome) }
    const kit = montarKit(beneficio, condicoes)
    const contrato: Contrato = { processoId: novo.id, fichaId: ficha.id, etapa: 'preparar', condicoes, kit, abertoEm: agora().toISOString() }
    const processo: Processo = { id: novo.id, beneficio, etapa: 'Contrato · preparar', proximaAcao: 'preparar o contrato', prazo: 'hoje' }
    await guardarContrato(ficha.id, { contrato, processo })
    ficha.historico.push(
      evento(
        kit
          ? `Fechou ${nomeBeneficio(beneficio)}: processo novo com o kit ${kit.nome} (${kit.documentos.length} documentos, ${modeloDoKit(kit)?.nome ?? 'sem modelo'})`
          : `Fechou ${nomeBeneficio(beneficio)}: processo novo, sem kit cadastrado para o benefício`,
        await quem(pedido),
      ),
    )
    await guardar(ficha)
    const [atual] = await fichas([ficha.id])
    return { ficha: atual, processo, contrato }
  })

  // GGVP-65 CA2, CA8: as condições do LOAS montam o kit de novo, só antes de gerar o contrato.
  app.put<{ Params: { id: string } }>('/api/processos/:id/contrato/condicoes', conduzir, async (pedido, resposta) => {
    const entrada = CondicoesDoKit.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Condições inválidas.')
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    if (contrato.etapa !== 'preparar') return negar(resposta, 400, 'O kit só muda antes de gerar o contrato.')
    const condicoes = entrada.data
    contrato.condicoes = { ...condicoes }
    contrato.kit = montarKit(processo.beneficio, condicoes)
    const marcadas = (Object.keys(ROTULOS_DAS_CONDICOES) as (keyof typeof condicoes)[]).filter((k) => condicoes[k]).map((k) => ROTULOS_DAS_CONDICOES[k])
    ficha.historico.push(evento(`Condições do kit de ${nomeBeneficio(processo.beneficio)}: ${marcadas.length ? marcadas.join(', ') : 'nenhuma'}`, await quem(pedido)))
    await guardarContrato(ficha.id, { contrato, processo })
    await guardar(ficha)
    return { contrato, ficha }
  })

  // GGVP-69: valida de novo a decisão, o que corrigir e as conferências (CA6). Com "Não, corrigir campos", grava a correção
  // (na ficha os dados pessoais; no contrato o RG, a parte contrária e o representante), registra no histórico (CA7) e
  // gera de novo (CA3). Campo obrigatório vazio não segue (CA7). GGVP-136: o kit é o Word do escritório, na versão em vigor do
  // modelo da linha do benefício, preenchido com a ficha e o caso (CA2, CA3). O que falta não gera e vai listado (CA4); o
  // arquivo gerado fica na pasta do cliente, com o modelo e a versão usados (CA6). Gerado, vai assinar.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/gerar', conduzir, async (pedido, resposta) => {
    const entrada = EnvioDoContrato.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Envio inválido.')
    const envio = entrada.data
    const oQueCorrigir = envio.oQueCorrigir ?? ''
    if (CONFERENCIAS.some((c) => envio.conferencias[c.id] !== true)) return negar(resposta, 400, 'Faltam conferências.')
    if (!envio.aprovados && (oQueCorrigir.length < 3 || oQueCorrigir.length > 500)) return negar(resposta, 400, 'Escreva o que corrigir.')
    const correcoes = (envio.aprovados ? {} : envio.correcoes) as Partial<Record<CampoDoModelo, string>>
    for (const [campo, valor] of Object.entries(correcoes) as [CampoDoModelo, string][])
      if (!(campo in ROTULOS_DOS_CAMPOS) || campo === 'beneficio' || erroDoCampo(campo, valor)) return negar(resposta, 400, 'Correção inválida.')
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    if (contrato.etapa !== 'preparar' || !contrato.kit) return negar(resposta, 400, 'Este contrato não está para preparar.')
    const modelo = modeloDoKit(contrato.kit)
    if (!modelo) return { resultado: 'sem-modelo' }
    const vigor = await modeloEmVigor(banco, modelo.id)
    if (!vigor) return { resultado: 'sem-modelo', modelo: modelo.nome }

    const mudou: CampoDoModelo[] = []
    const dados: DadosDoContrato = { ...contrato.dados }
    for (const [campo, bruto] of Object.entries(correcoes) as [CampoDoModelo, string][]) {
      const valor = normalizarCampo(campo, bruto)
      if (daFicha(campo)) {
        if ((ficha[campo] ?? '') !== valor) {
          ficha[campo] = valor
          mudou.push(campo)
        }
      } else if (campo !== 'parteContraria' || linhaDoBeneficio(processo.beneficio)?.acaoContra) {
        const chave = campo as keyof DadosDoContrato
        if ((dados[chave] ?? '') !== valor) {
          dados[chave] = valor
          mudou.push(campo)
        }
      }
    }
    const dono = fichaComCpf((await fichas()).filter((f) => f.id !== ficha.id), ficha.cpf)
    if (dono) return { resultado: 'cpf-de-outra-ficha', nome: dono.nome }
    contrato.dados = dados
    contrato.corrigidos = [...new Set([...(contrato.corrigidos ?? []), ...mudou])]

    const campos = camposDoCaso({ ficha, processo, contrato }, true)
    const faltam = faltando(campos)
    if (faltam.length > 0) return { resultado: 'faltam', campos: faltam }
    const arquivoDoModelo = await armazenamento.ler(vigor.arquivo.chave)
    const lido = lerModelo(arquivoDoModelo)
    if (!lido.ok) return { resultado: 'sem-modelo', modelo: modelo.nome }
    const dia = hoje()
    const valores = valoresDoKit({ ficha, dados: dadosDoCaso(ficha, contrato), linha: contrato.kit.linha, representado: kitRepresentado(processo.beneficio, contrato.condicoes) }, dia)
    const faltamNaFicha = faltamNoKit(lido.variaveis, valores)
    if (faltamNaFicha.length > 0) return { resultado: 'faltam-na-ficha', faltam: faltamNaFicha }

    const geradoEm = agora().toISOString()
    const versao = (contrato.documento?.versao ?? 0) + 1
    const nomeDoArquivo = `Kit do contrato - versão ${versao}.docx`
    const guardado = await guardarArquivo(armazenamento, processo.id, { conteudo: preencherModelo(arquivoDoModelo, valores, dia), mime: TIPO_DO_DOCX, nome: nomeDoArquivo }, 'kit-do-contrato.docx')
    const [kitGuardado] = await banco
      .insert(documento)
      .values({ casoId: processo.id, pessoaId: ficha.id, tipo: 'kit_contrato', origem: 'portal', recebidoPor: pedido.usuario!.id, ...guardado })
      .returning({ id: documento.id })
    const modeloUsado = { ...modelo, versao: vigor.versao }
    const motivo = envio.aprovados ? `gerado pelo ${modelo.nome}` : `corrigido: ${oQueCorrigir}`
    contrato.documento = { versao, geradoEm, campos, textos: [], modelo: { id: modelo.id, versao: vigor.versao }, arquivo: { documentoId: kitGuardado.id, nome: nomeDoArquivo } }
    contrato.versoes = [...(contrato.versoes ?? []), { versao, geradoEm, motivo }]
    contrato.etapa = 'assinatura'
    const seguinte: Processo = { ...processo, etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' }
    const nome = await quem(pedido)
    if (mudou.length > 0) ficha.historico.push(evento(`Corrigiu no contrato: ${juntar(mudou.map((c) => ROTULOS_DOS_CAMPOS[c]))} (${oQueCorrigir})`, nome))
    ficha.historico.push(
      evento(
        `Gerou o contrato de ${nomeBeneficio(processo.beneficio)} pelo modelo ${identificadorDoModelo(modeloUsado)} (versão ${versao}), guardado na pasta do cliente: ` +
          'conferiu os campos, as datas à mão, a ficha LOAS e a página do Código Penal',
        nome,
      ),
    )
    await guardarContrato(ficha.id, { contrato, processo: seguinte })
    await guardar(ficha)
    return { resultado: 'gerado', contrato, ficha: (await fichas([ficha.id]))[0] }
  })

  // GGVP-72 CA1, CA4, CA5, CA12: o ZapSign (simulado) monta o documento pelo modelo e devolve o link. Um documento por kit:
  // pedir de novo devolve o mesmo. A mensagem do WhatsApp com o link volta pronta para conferir.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/zapsign', conduzir, async (pedido, resposta) => {
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    if (contrato.etapa !== 'assinatura' || !contrato.kit) return negar(resposta, 400, 'Este contrato não está para assinar.')
    if (contrato.assinatura?.forma === 'papel' && contrato.assinatura.arquivo) return negar(resposta, 400, 'O contrato assinado em papel já foi digitalizado.')
    const assinatura: Assinatura = { ...(contrato.assinatura ?? { tentativas: [] }), forma: 'digital' }
    contrato.assinatura = assinatura
    if (!assinatura.zapsign) {
      // A versão corrigida (GGVP-85) é outro documento.
      const versao = contrato.documento?.versao ?? 1
      const documentoId = `zapsign-exemplo-${processo.id}${versao > 1 ? `-v${versao}` : ''}`
      assinatura.zapsign = { documentoId, link: linkDoZapSign(documentoId), status: 'enviado', criadoEm: agora().toISOString(), eventos: [] }
      ficha.historico.push(evento(`Gerou o documento no ZapSign pelo modelo ${identificadorDoKit(contrato.kit)}: ${documentoId}`, await quem(pedido)))
      await guardar(ficha)
    }
    await guardarContrato(ficha.id, { contrato, processo })
    return { resultado: 'gerado', contrato, mensagem: mensagemDoLink(ficha.nome, assinatura.zapsign.link, assinatura.tentativas.length > 0), ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-72 CA2, CA5, CA11: cada tentativa fica com a data e o canal, e reenviar o link não cria outro documento. A primeira é
  // o link enviado; a próxima, 3 dias depois. Com a segunda sem assinatura, o caso sobe para a advogada sênior (G15), com a
  // tarefa no banco, e sai da Central do Atendimento.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/tentativas', conduzir, async (pedido, resposta) => {
    const entrada = TentativaDoContrato.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Canal inválido.')
    const { canal, mensagem } = entrada.data
    if (canal === 'whatsapp' && !mensagem) return negar(resposta, 400, 'Escreva a mensagem.')
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    const a = contrato.assinatura
    if (!a?.zapsign || a.zapsign.status === 'assinado') return negar(resposta, 400, 'Não há assinatura pendente no ZapSign.')
    const dia = hoje()
    const cobranca = cobrancaDaAssinatura(a.tentativas, dia)
    if (cobranca.noLimite || (cobranca.proximaEm !== undefined && dia < cobranca.proximaEm)) return negar(resposta, 400, 'Ainda não é dia de tentar de novo.')
    const nome = await quem(pedido)
    a.tentativas.push({ data: dia, quando: agora().toISOString(), canal, quem: nome })
    const n = a.tentativas.length
    const pelo = NOMES_DOS_CANAIS[canal]
    ficha.contatos.push({
      data: dia,
      canal: pelo,
      texto: n === 1 ? 'Link do ZapSign enviado para assinar o contrato.' : `Lembrete da assinatura do contrato (tentativa ${n} de ${TENTATIVAS_DE_ASSINATURA}); o link é o mesmo.`,
    })
    ficha.historico.push(
      evento(
        n === 1
          ? `Enviou o link do ZapSign pelo ${pelo} (tentativa 1 de ${TENTATIVAS_DE_ASSINATURA})`
          : `Tentou contato de novo pelo ${pelo} (tentativa ${n} de ${TENTATIVAS_DE_ASSINATURA}), sem criar outro documento no ZapSign`,
        nome,
      ),
    )
    if (n >= TENTATIVAS_DE_ASSINATURA) {
      a.naSenior = true
      await abrirTarefa({
        id: `senior-assinatura-${processo.id}`,
        codigo: 'D1.17',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Colher assinatura · limite de tentativas',
        detalhe: `${nomeBeneficio(processo.beneficio)} · ${n} tentativas sem assinatura (G15) · o Atendimento tentou em ${a.tentativas.map((t) => dataCurta(t.data, dia)).join(' e ')}`,
        prazo: 'hoje',
        urgente: true,
        href: `/contrato/${processo.id}/assinatura`,
        processoId: processo.id,
        setor: 'Jurídico',
      })
      ficha.historico.push(evento(`Subiu para a advogada sênior: ${n} tentativas sem assinatura (G15)`, nome))
    }
    await guardarContrato(ficha.id, { contrato, processo })
    await guardar(ficha)
    return { contrato, ficha: await fichaPeloId(ficha.id), tarefas: await tarefas(ficha.id) }
  })

  // GGVP-72 CA6, CA7, CA10, simulado: o botão da tela faz o papel do retorno do ZapSign. O de verdade chega pelo webhook, com
  // o segredo, quando o ZapSign for contratado; este botão sai junto. O mesmo evento não anexa duas vezes. Assinado, o arquivo
  // final com as evidências vai ao card e segue para a leitura; a tarefa da assinatura se encerra, inclusive a da sênior.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/zapsign/retorno-simulado', conduzir, async (pedido, resposta) => {
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    const z = contrato.assinatura?.zapsign
    if (!z) return negar(resposta, 400, 'Não há documento no ZapSign.')
    const eventoId = `${z.documentoId}-assinado`
    if (z.eventos.includes(eventoId) || z.status === 'assinado') return { resultado: 'repetido', contrato, ficha }
    const dia = hoje()
    const arquivo: Arquivo = {
      nome: `Contrato assinado - ${ficha.nome} - ${dia} (ZapSign, com evidências).pdf`,
      tipo: 'contrato',
      local: processo.id,
      data: dia,
      origem: 'card',
      repetido: false,
      aguardaLeitura: true,
    }
    z.status = 'assinado'
    z.eventos.push(eventoId)
    contrato.assinatura = { ...contrato.assinatura!, assinadoEm: agora().toISOString(), arquivo: arquivo.nome }
    contrato.etapa = 'leitura'
    await concluirTarefas(ficha.id, 'Colher assinatura · limite de tentativas', `senior-assinatura-${processo.id}`)
    ficha.historico.push(evento('O ZapSign devolveu o contrato assinado: anexado no card com as evidências da assinatura; segue para a leitura', 'ZapSign'))
    await guardarContrato(ficha.id, { contrato, processo: assinado(processo) })
    await guardar(ficha)
    return { resultado: 'anexado', arquivo, contrato, ficha: await fichaPeloId(ficha.id), tarefas: await tarefas(ficha.id) }
  })

  // GGVP-77 CA1, CA4: "Papel, na hora": o kit sai com as datas em branco para preencher à mão, menos o contrato de
  // honorários. Só na entrevista presencial. A impressora é simulada.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/impressao', conduzir, async (pedido, resposta) => {
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const motivo = semPapel(achado)
    if (motivo) return negar(resposta, 400, motivo)
    const { ficha, processo, contrato } = achado
    noPapel(contrato).impressoEm = agora().toISOString()
    ficha.historico.push(
      evento(`Imprimiu o kit para assinar em papel na hora (${contrato.kit!.documentos.length} documentos, datas em branco menos a do contrato de honorários)`, await quem(pedido)),
    )
    await guardarContrato(ficha.id, { contrato, processo })
    await guardar(ficha)
    return { contrato, datas: datasDoKit(contrato.kit!, 'papel', hoje()), ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-77 CA2, simulado: o contrato assinado passa no scanner do balcão; a automação guarda o PDF pesquisável na pasta do
  // cliente, e o arquivo aparece no card, para a leitura.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/digitalizacao', conduzir, async (pedido, resposta) => {
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const motivo = semPapel(achado)
    if (motivo) return negar(resposta, 400, motivo)
    const { ficha, processo, contrato } = achado
    const assinatura = noPapel(contrato)
    if (!assinatura.impressoEm) return negar(resposta, 400, 'Imprima o kit antes.')
    if (assinatura.arquivo) return negar(resposta, 400, 'O contrato assinado já foi digitalizado.')
    const dia = hoje()
    const arquivo: Arquivo = {
      nome: `Contrato assinado - ${ficha.nome} - ${dia} (papel, PDF pesquisável).pdf`,
      tipo: 'contrato',
      local: processo.id,
      data: dia,
      origem: 'scanner',
      repetido: false,
      aguardaLeitura: true,
    }
    assinatura.arquivo = arquivo.nome
    ficha.historico.push(evento('Digitalizou o contrato assinado em papel: PDF pesquisável na pasta do cliente', 'Automação do balcão'))
    await guardarContrato(ficha.id, { contrato, processo })
    await guardar(ficha)
    return { arquivo, contrato, ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-77 CA3: a assinatura em papel só conclui com a digitalização do contrato assinado anexada; segue para a leitura.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/assinatura-em-papel', conduzir, async (pedido, resposta) => {
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const motivo = semPapel(achado)
    if (motivo) return negar(resposta, 400, motivo)
    const { ficha, processo, contrato } = achado
    const assinatura = noPapel(contrato)
    if (!assinatura.arquivo) return negar(resposta, 400, 'Anexe a digitalização do contrato assinado.')
    assinatura.assinadoEm = agora().toISOString()
    contrato.etapa = 'leitura'
    ficha.historico.push(evento('Concluiu a assinatura em papel, com a digitalização anexada; segue para a leitura', await quem(pedido)))
    await guardarContrato(ficha.id, { contrato, processo: assinado(processo) })
    await guardar(ficha)
    return { contrato, ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-85 CA1, CA2, CA4, CA7, simulado: a leitura da IA do contrato assinado; a de verdade é da GGVP-81, aqui no servidor,
  // e nunca vem da tela. Reconhecido e tudo certo, segue para a cópia, sem tarefa; sem entender ou com problema, o
  // Atendimento recebe "Conferir contrato" com o que a IA apontou.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/leitura-simulada', conduzir, async (pedido, resposta) => {
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    if (contrato.etapa !== 'leitura') return negar(resposta, 400, 'Este contrato não está esperando a leitura.')
    const leitura = leituraDeExemploDoContrato(contrato)
    contrato.leitura = { ...leitura, lidoEm: agora().toISOString() }
    const conferir = precisaConferir(leitura)
    contrato.etapa = conferir ? 'conferir' : 'copia'
    const seguinte: Processo = conferir
      ? { ...processo, etapa: 'Contrato · conferência', proximaAcao: 'conferir o contrato assinado' }
      : { ...processo, proximaAcao: 'entregar a cópia do contrato' }
    ficha.historico.push(
      evento(
        conferir
          ? `A IA leu o contrato assinado: ${resumoDaLeitura(leitura)}; o Atendimento confere`
          : 'A IA leu o contrato assinado e reconheceu: tudo certo; segue para a cópia do contrato',
        'IA (leitura)',
      ),
    )
    await guardarContrato(ficha.id, { contrato, processo: seguinte })
    await guardar(ficha)
    return { contrato, ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-85 CA3, CA5, CA6, CA7: "Está certo, seguir" vai para a cópia. "Não, corrigir e reenviar": o que corrigir é
  // obrigatório e a página corrigida pode ir anexa; a versão assinada fica no histórico e o contrato volta a preparar.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/verificacao', conduzir, async (pedido, resposta) => {
    const entrada = VerificacaoDoContrato.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Verificação inválida.')
    const v = entrada.data
    const oQueCorrigir = v.oQueCorrigir ?? ''
    if (motivoParadoDaVerificacao(v.tudoCerto, oQueCorrigir)) return negar(resposta, 400, 'Escreva o que corrigir.')
    const pagina = v.tudoCerto ? undefined : v.paginaCorrigida
    if (pagina && problemaDoArquivo(pagina)) return negar(resposta, 400, 'Página corrigida inválida.')
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha, processo, contrato } = achado
    if (contrato.etapa !== 'conferir') return negar(resposta, 400, 'Este contrato não está para conferir.')
    const nome = await quem(pedido)
    const quando = agora().toISOString()
    const dia = hoje()
    let seguinte: Processo
    let arquivo: Arquivo | undefined
    if (v.tudoCerto) {
      contrato.verificacao = { tudoCerto: true, quem: nome, quando }
      contrato.etapa = 'copia'
      const assinadoEm = hojeEmBrasilia(new Date(contrato.assinatura?.assinadoEm ?? quando))
      seguinte = { ...processo, etapa: `Contrato assinado em ${dataCurta(assinadoEm, dia)}`, proximaAcao: 'entregar a cópia do contrato' }
      ficha.historico.push(evento('Conferiu o contrato assinado: está certo; segue para a cópia do contrato', nome))
    } else {
      const versao = contrato.documento?.versao ?? 1
      if (pagina) arquivo = { nome: pagina.nome, tipo: 'contrato', local: processo.id, data: dia, origem: 'card', repetido: false, aguardaLeitura: false }
      contrato.verificacao = { tudoCerto: false, oQueCorrigir, ...(pagina && { paginaCorrigida: pagina.nome }), quem: nome, quando }
      contrato.anteriores = [...(contrato.anteriores ?? []), { versao, arquivo: contrato.assinatura?.arquivo, motivo: oQueCorrigir, quando }]
      delete contrato.assinatura
      delete contrato.leitura
      contrato.etapa = 'preparar'
      seguinte = { ...processo, etapa: 'Contrato · corrigir e reenviar', proximaAcao: 'corrigir os campos e reenviar para assinar' }
      ficha.historico.push(evento(`Conferiu o contrato assinado: corrigir e reenviar (${oQueCorrigir}). A versão ${versao} assinada fica guardada no histórico`, nome))
    }
    await guardarContrato(ficha.id, { contrato, processo: seguinte })
    await guardar(ficha)
    return { contrato, ficha: await fichaPeloId(ficha.id), ...(arquivo && { arquivo }) }
  })

  // GGVP-85: o aviso ao cliente pelo WhatsApp, da tela de conferir, fica em "Últimos contatos" (Chatwoot simulado).
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/conferencia/aviso', conduzir, async (pedido, resposta) => {
    const entrada = MensagemEnviada.safeParse(pedido.body)
    if (!entrada.success || !entrada.data.mensagem) return negar(resposta, 400, 'Escreva a mensagem.')
    const achado = await acharContrato(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_CONTRATO_NAO_ENCONTRADO)
    const { ficha } = achado
    ficha.contatos.push({ data: hoje(), canal: 'WhatsApp', texto: 'Avisado da pendência no contrato assinado.' })
    ficha.historico.push(evento('Avisou o cliente pelo WhatsApp da pendência no contrato assinado', await quem(pedido)))
    await guardar(ficha)
    return { ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-89 CA1: "Imprimir cópia para o cliente": a versão assinada. A impressora é simulada.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/copia/impressao', conduzir, async (pedido, resposta) => {
    const achado = await paraACopia(pedido.params.id)
    if ('erro' in achado) return negar(resposta, achado.status, achado.erro)
    const { ficha, processo, contrato } = achado
    contrato.copia = { ...contrato.copia, impressaEm: agora().toISOString() }
    ficha.historico.push(evento(`Imprimiu a cópia do contrato assinado para o cliente levar: ${contrato.assinatura?.arquivo ?? 'versão assinada'}`, await quem(pedido)))
    await guardarContrato(ficha.id, { contrato, processo })
    await guardar(ficha)
    return { contrato, ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-89 CA4: a entrega fica para uma visita: o compromisso "Entregar cópia do contrato" entra na agenda com a data da
  // visita; a que já estava marcada fica remarcada.
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/copia/visita', conduzir, async (pedido, resposta) => {
    const entrada = VisitaDaCopia.safeParse(pedido.body)
    const dia = hoje()
    const erros = entrada.success ? errosDaVisita(entrada.data.data, entrada.data.hora, dia) : { data: 'inválida' }
    if (!entrada.success || erros.data || erros.hora) return negar(resposta, 400, 'Visita inválida.')
    const achado = await paraACopia(pedido.params.id)
    if ('erro' in achado) return negar(resposta, achado.status, achado.erro)
    const { ficha, processo, contrato } = achado
    const anterior = visitaDaCopia(ficha, contrato)
    if (anterior) anterior.estado = 'remarcado'
    let n = 1
    while (ficha.agendamentos.some((a) => a.id === `copia-${processo.id}-${n}`)) n += 1
    const { hora } = entrada.data
    const visita: Agendamento = {
      id: `copia-${processo.id}-${n}`,
      data: dataParaIso(normalizarData(entrada.data.data))!,
      hora,
      oQue: 'Entregar cópia do contrato',
      tipo: 'presencial',
      duracao: 30,
    }
    ficha.agendamentos.push(visita)
    contrato.copia = { ...contrato.copia, visitaId: visita.id }
    ficha.historico.push(evento(`Marcou a entrega da cópia do contrato numa visita: ${dataCurta(visita.data, dia)} às ${hora}`, await quem(pedido)))
    await guardarContrato(ficha.id, { contrato, processo })
    await guardar(ficha)
    return { visita, contrato, ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-89 CA3, CA5: só com a confirmação de que é a cópia impressa da versão assinada, a data da entrega e quem recebeu; a
  // observação é opcional. Registrada, o caso segue para o checklist do benefício (D1.21).
  app.post<{ Params: { id: string } }>('/api/processos/:id/contrato/copia/entrega', conduzir, async (pedido, resposta) => {
    const entrada = EntregaDaCopia.safeParse(pedido.body)
    const dia = hoje()
    if (!entrada.success || motivoParadoDaEntrega(entrada.data, dia)) return negar(resposta, 400, 'Entrega inválida.')
    const v = entrada.data
    const achado = await paraACopia(pedido.params.id)
    if ('erro' in achado) return negar(resposta, achado.status, achado.erro)
    const { ficha, processo, contrato } = achado
    const nome = await quem(pedido)
    const entregueEm = dataParaIso(normalizarData(v.entregueEm))!
    const quemRecebeu = normalizarNome(v.quemRecebeu)
    const observacao = v.observacao || undefined
    contrato.copia = { ...contrato.copia, entrega: { entregueEm, quemRecebeu, ...(observacao && { observacao }), quem: nome, quando: agora().toISOString() } }
    const visita = visitaDaCopia(ficha, contrato)
    if (visita) visita.estado = 'realizado'
    contrato.etapa = 'entregue'
    const seguinte: Processo = {
      ...processo,
      etapa: 'Documentação · checklist do benefício',
      proximaAcao: 'conferir o checklist do benefício (D1.21)',
      prazo: undefined,
      urgente: undefined,
    }
    ficha.contatos.push({
      data: entregueEm,
      canal: 'Presencial',
      texto: `Recebeu a cópia do contrato assinado${quemRecebeu === ficha.nome ? '' : ` (entregue a ${quemRecebeu})`}.${observacao ? ` ${observacao}` : ''}`,
    })
    ficha.historico.push(
      evento(`Entregou a cópia impressa da versão assinada em ${dataCurta(entregueEm, dia)} a ${quemRecebeu}; o caso segue para o checklist do benefício (D1.21)`, nome),
    )
    await guardarContrato(ficha.id, { contrato, processo: seguinte })
    await guardar(ficha)
    return { contrato, ficha: await fichaPeloId(ficha.id) }
  })
}
