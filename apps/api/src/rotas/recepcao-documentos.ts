// Os documentos da Recepção no servidor (GGVP-125, bloco 5b), sobre o fichário: a chegada pelo card e pelo lote do scanner,
// o registro do recebimento, a leitura da IA (simulada), uma por arquivo, e a conferência da Documentação. As regras são as do servidor de exemplo do Pedro
// (documentos.ts e leitura.ts), com as regras puras importadas das telas. O arquivo de verdade segue simulado até o Drive.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { dataParaIso, normalizarCpf, validarCpf, validarNome } from '@ggv/campos'
import { ArquivamentoDosLidos, CampoLidoNoCadastro, EnvioDeArquivos, MudancaDeCaso, RegistroDoRecebimento, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { contratoRecepcao, leituraDocumento, tarefaRecepcao } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { TIPOS_DE_DOCUMENTO, nomeBeneficio, nomeTipo } from '../../../web/src/dados/catalogos.ts'
import { loteDeExemplo } from '../../../web/src/dados/exemplo.ts'
import type { Arquivo, EventoHistorico, Ficha, Processo, TarefaEncaminhada } from '../../../web/src/dados/tipos.ts'
import { formatoDoArquivo, localDoTipo, nomeSemSobrescrever, problemaDoArquivo } from '../../../web/src/regras/arquivos.ts'
import { fichasCitadas } from '../../../web/src/regras/busca.ts'
import { normalizarRg } from '../../../web/src/regras/cadastro.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import { fichaComCpf } from '../../../web/src/regras/duplicidade.ts'
import { ROTULOS_DOS_CAMPOS, ehMedico, menosLegivel, type DocumentoLido } from '../../../web/src/regras/leitura.ts'
import { criarLeituraDoContrato } from './recepcao-contrato.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario, type ContratoGuardado } from './recepcao.ts'

/** Os tipos que trazem a avaliação do médico: chegando pelo card ou pelo chat, são "Laudo novo" (GGVP-17 CA6). */
const LAUDOS = ['laudo', 'relatorio-medico', 'prontuario']

/** Quem aparece no histórico quando o scanner guarda o papel. */
const SCANNER = 'Automação do scanner'

const documentos = (n: number) => (n === 1 ? '1 documento' : `${n} documentos`)
const emConferencia = (l: DocumentoLido) => l.situacao === 'a-conferir' || l.situacao === 'quarentena'
const rotuloDoCaso = (ficha: Ficha, p: Processo) => `${ficha.nome} · ${nomeBeneficio(p.beneficio)}${p.numero ? ` · ${p.numero}` : ''}`
const dataValida = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && dataParaIso(iso.split('-').reverse().join('/')) === iso

/** Ilegível ainda em aberto: nenhum documento legível do mesmo tipo chegou depois, para a mesma ficha (GGVP-95, CA3). */
const ilegivelEmAberto = (l: DocumentoLido, leituras: DocumentoLido[]) =>
  l.situacao === 'ilegivel' && !leituras.some((o) => o.fichaId === l.fichaId && o.tipo === l.tipo && o.situacao !== 'ilegivel' && o.lidoEm > l.lidoEm)
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

type Opcoes = { banco: Banco; agora?: () => Date }

export function registrarRotasRecepcaoDocumentos(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const { hoje, evento, nomeDe, fichas, guardar, abrirTarefa, concluirTarefas, tarefas, leiturasDe, guardarLeitura, lerArquivosNovos } = criarFichario(banco, agora)
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }
  const lerContrato = criarLeituraDoContrato(banco, agora)

  const fichaPeloId = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)

  /** A tarefa da Recepção pelo id das telas, e a ficha dela. */
  async function tarefaEFicha(id: string): Promise<{ tarefa: TarefaEncaminhada; concluida: boolean; ficha: Ficha } | null> {
    const [linha] = await banco.select().from(tarefaRecepcao).where(eq(tarefaRecepcao.id, id))
    const ficha = linha && (await fichaPeloId(linha.pessoaId))
    return linha && ficha ? { tarefa: linha.dados as TarefaEncaminhada, concluida: linha.concluidaEm !== null, ficha } : null
  }

  /** A leitura pelo id ("<ficha>/<arquivo>") e a ficha dela. */
  async function leituraEFicha(id: string): Promise<{ doc: DocumentoLido; ficha: Ficha } | null> {
    const [linha] = await banco.select().from(leituraDocumento).where(eq(leituraDocumento.id, id))
    const ficha = linha && (await fichaPeloId(linha.pessoaId))
    return linha && ficha ? { doc: linha.dados as DocumentoLido, ficha } : null
  }

  /** Os contratos da Recepção de uma pessoa, para a cópia das telas depois da leitura do assinado. */
  const contratosDe = async (pessoaId: string) =>
    (await banco.select().from(contratoRecepcao).where(eq(contratoRecepcao.pessoaId, pessoaId))).map((c) => (c.dados as ContratoGuardado).contrato)

  /** O laudo novo também marca o processo dele, quando o caso tem o contrato da Recepção. */
  async function marcarLaudoNoProcesso(processoId: string, dia: string) {
    const [linha] = await banco.select().from(contratoRecepcao).where(eq(contratoRecepcao.casoId, processoId))
    if (!linha) return
    const g = linha.dados as ContratoGuardado
    const dados = { ...g, processo: { ...g.processo, laudoNovoEm: dia } }
    await banco.update(contratoRecepcao).set({ dados, atualizadoEm: agora() }).where(eq(contratoRecepcao.casoId, processoId))
  }

  // GGVP-17 CA6, CA7, CA11, CA13, CA14: "Conferir e enviar". Nada é apagado nem sobrescrito; o mesmo conteúdo já na pasta
  // fica marcado como repetido. Laudo marca "Laudo novo" na ficha e no processo e avisa o Jurídico; o resumo simulado não
  // é guardado (dado de saúde). A pasta do Drive é conferida nas telas, antes de chamar. A IA lê o que chegou (GGVP-81).
  app.post<{ Params: { id: string } }>('/api/fichas/:id/arquivos', editar, async (pedido, resposta) => {
    const entrada = EnvioDeArquivos.safeParse(pedido.body)
    const valido = (a: EnvioDeArquivos['arquivos'][number]) =>
      !problemaDoArquivo(a) && formatoDoArquivo(a.nome) === a.formato && TIPOS_DE_DOCUMENTO.some((t) => t.id === a.tipo)
    if (!entrada.success || !entrada.data.arquivos.every(valido)) return negar(resposta, 400, 'Arquivos inválidos.')
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const { origem } = entrada.data
    const dia = hoje()
    const caso = ficha.processos[0]
    const novos: Arquivo[] = entrada.data.arquivos.map((a) => {
      const local = localDoTipo(a.tipo, caso?.id)
      const nomes = ficha.arquivos.filter((x) => x.local === local).map((x) => x.nome)
      const repetido = ficha.arquivos.some((x) => x.hash === a.hash)
      const arquivo: Arquivo = { nome: nomeSemSobrescrever(a.nome, nomes), tipo: a.tipo, local, data: dia, origem, repetido, aguardaLeitura: true, hash: a.hash }
      ficha.arquivos.push(arquivo)
      return arquivo
    })
    const quem = await nomeDe(pedido)
    const pelo = origem === 'chat' ? 'pelo chat' : 'pelo card'
    // Laudo, relatório médico e prontuário contam como laudo novo: vão à comparação do Jurídico (GGVP-95, CA4; GGVP-29, CA5).
    const laudos = novos.filter((a) => LAUDOS.includes(a.tipo) && !a.repetido)
    if (laudos.length > 0) {
      ficha.laudoNovoEm = dia
      if (caso) await marcarLaudoNoProcesso(caso.id, dia)
      await abrirTarefa({
        id: `laudo-${randomUUID()}`,
        codigo: 'D1.21M',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Analisar laudo novo',
        detalhe: [caso ? nomeBeneficio(caso.beneficio) : 'sem caso em andamento', `laudo novo de ${dataCurta(dia, dia)}`].join(' · '),
        prazo: 'hoje',
        href: caso ? `/casos/${caso.id}/laudo-novo` : `/clientes/${ficha.id}`,
        processoId: caso?.id,
        setor: 'Jurídico',
      })
      ficha.historico.push(evento(`Subiu laudo novo ${pelo}; enviado ao Jurídico para análise`, quem))
    }
    const outros = novos.filter((a) => !laudos.includes(a))
    if (outros.length > 0) {
      const repetidos = outros.filter((a) => a.repetido).length
      const tipos = [...new Set(outros.map((a) => nomeTipo(a.tipo)))].join(', ')
      ficha.historico.push(evento(`Anexou ${documentos(outros.length)} ${pelo} (${tipos})${repetidos > 0 ? `; ${repetidos} já estava na pasta` : ''}`, quem))
    }
    await guardar(ficha)
    const leituras = await lerArquivosNovos(ficha)
    return { resultado: 'enviado', arquivos: novos, laudoNovo: laudos.length > 0, ficha: await fichaPeloId(ficha.id), tarefas: await tarefas(ficha.id), leituras }
  })

  // GGVP-17 CA2, CA4, CA10: o lote do scanner (o aviso do n8n), simulado. Lote em revisão não mexe no portal. No servidor
  // ainda não há a lista de pastas do Drive: a ficha tem pasta se já tiver uma ligada ou se tiver CPF (pasta nova só nasce
  // com o CPF, CA11).
  app.post<{ Params: { id: string } }>('/api/tarefas/:id/lote', editar, async (pedido, resposta) => {
    const achada = await tarefaEFicha(pedido.params.id)
    if (!achada) return negar(resposta, 404, 'Tarefa não encontrada.')
    const { tarefa, ficha } = achada
    const dia = hoje()
    const pastaId = ficha.pastaId ?? (ficha.cpf ? `drive-${ficha.id}` : undefined)
    const lote = loteDeExemplo({ ...ficha, pastaId }, dia, `lote-${randomUUID().slice(0, 8)}`)
    await banco.update(tarefaRecepcao).set({ dados: { ...tarefa, lote } }).where(eq(tarefaRecepcao.id, tarefa.id))
    if (lote.fichaId === ficha.id) {
      for (const a of lote.arquivos) {
        const local = localDoTipo(a.tipo, tarefa.processoId)
        const nomes = ficha.arquivos.filter((x) => x.local === local).map((x) => x.nome)
        ficha.arquivos.push({ nome: nomeSemSobrescrever(a.nome, nomes), tipo: a.tipo, local, data: dia, origem: 'scanner', repetido: false, aguardaLeitura: true })
      }
      const aviso = lote.conferirPapel ? ', com o aviso CONFERIR O PAPEL' : ''
      ficha.historico.push(evento(`Guardou ${documentos(lote.arquivos.length)} na pasta do Drive, em PDF pesquisável${aviso}`, SCANNER))
      await guardar(ficha)
    }
    const leituras = await lerArquivosNovos(ficha)
    return { lote, ficha: await fichaPeloId(ficha.id), tarefas: await tarefas(ficha.id), leituras }
  })

  // GGVP-17 CA5, CA10: "Registrar", só depois de conferir o tipo de cada documento, e o papel quando o lote avisou. A
  // tarefa se conclui no servidor.
  app.post<{ Params: { id: string } }>('/api/tarefas/:id/registro', editar, async (pedido, resposta) => {
    const entrada = RegistroDoRecebimento.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Confira o tipo de cada documento.')
    const achada = await tarefaEFicha(pedido.params.id)
    if (!achada) return negar(resposta, 404, 'Tarefa não encontrada.')
    const { tarefa, concluida, ficha } = achada
    if (concluida) return negar(resposta, 400, 'Esta tarefa já foi registrada.')
    const registro = entrada.data
    let texto: string
    if (registro.forma === 'papel') {
      if (!tarefa.lote) return negar(resposta, 400, 'O lote do scanner ainda não chegou.')
      if (tarefa.lote.conferirPapel && !registro.conferiPapel) return negar(resposta, 400, 'Confira o papel antes de devolver o original.')
      const revisao = tarefa.lote.status === 'revisao' ? ' (o lote foi para A REVISAR)' : ''
      texto = `Registrou o recebimento de ${documentos(tarefa.lote.arquivos.length)} em papel, pelo scanner${revisao}`
    } else {
      const anexados = ficha.arquivos.filter((a) => a.origem === 'card' && a.data === hoje()).length
      if (anexados === 0) return negar(resposta, 400, 'Nenhum arquivo anexado ao card.')
      texto = `Registrou o recebimento de ${documentos(anexados)} digitais, anexados ao card`
    }
    await concluirTarefas(ficha.id, tarefa.acao, tarefa.id)
    const registrado = evento(`${texto}; conferiu o tipo de cada documento`, await nomeDe(pedido))
    ficha.historico.push(registrado)
    await guardar(ficha)
    return { evento: registrado, ficha: await fichaPeloId(ficha.id), tarefas: await tarefas(ficha.id) }
  })

  // GGVP-81 CA1 a CA3, CA10, CA11; GGVP-95 CA3: os documentos a conferir e em quarentena, os casos para onde podem ir (os do
  // cliente e, para a quarentena, os de quem a IA leu no papel) e os ilegíveis.
  app.get<{ Params: { id: string } }>('/api/fichas/:id/documentos-lidos', editar, async (pedido, resposta) => {
    const todas = await fichas()
    const ficha = todas.find((f) => f.id === pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const leituras = await leiturasDe(ficha.id)
    const docs = leituras.filter(emConferencia)
    const donos = docs
      .filter((l) => l.situacao === 'quarentena')
      .flatMap((l) => [fichaComCpf(todas, l.lidos.cpf), ...fichasCitadas(todas, l.lidos.nome ?? '')])
      .filter((f): f is Ficha => f !== undefined && f.id !== ficha.id)
    return {
      ficha,
      processo: ficha.processos[0],
      documentos: docs,
      destinos: [ficha, ...new Set(donos)].flatMap((f) => f.processos.map((p) => ({ processoId: p.id, rotulo: rotuloDoCaso(f, p) }))),
      ilegiveis: leituras.filter((l) => ilegivelEmAberto(l, leituras)),
    }
  })

  // GGVP-81 CA4, CA7, CA9, CA16: "Arquivar", só depois de "Conferi os documentos lidos pela IA", com o tipo e a data de cada
  // documento a conferir. O duplicado só sai com a decisão da pessoa, e documento médico nunca sai. O contrato assinado
  // arquivado segue para a verificação do contrato (GGVP-85).
  app.post<{ Params: { id: string } }>('/api/fichas/:id/documentos-lidos/arquivar', editar, async (pedido, resposta) => {
    const entrada = ArquivamentoDosLidos.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Confira os documentos lidos pela IA.')
    const p = entrada.data
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const leituras = await leiturasDe(ficha.id)
    const aConferir = leituras.filter((l) => l.situacao === 'a-conferir')
    if (aConferir.length === 0) return negar(resposta, 400, 'Nenhum documento para arquivar.')
    const escolhas = new Map(p.documentos.map((d) => [d.id, d]))
    if (escolhas.size !== aConferir.length || aConferir.some((l) => !escolhas.has(l.id))) return negar(resposta, 400, 'A conferência mudou: abra a tela de novo.')
    if (p.documentos.some((d) => !TIPOS_DE_DOCUMENTO.some((t) => t.id === d.tipo) || !dataValida(d.data))) return negar(resposta, 400, 'Tipo ou data inválidos.')
    const copias = aConferir.filter((l) => l.duplicadoDe)
    if (copias.length > 0 && !p.duplicados) return negar(resposta, 400, 'Decida o que fazer com o documento duplicado.')
    const saem = new Set<DocumentoLido>()
    if (p.duplicados === 'descartar') {
      for (const copia of copias) {
        const original = leituras.find((l) => l.id === copia.duplicadoDe)
        const sai = original?.situacao === 'a-conferir' ? menosLegivel(original, copia) : copia
        if (ehMedico(escolhas.get(sai.id)?.tipo ?? sai.tipo)) return negar(resposta, 400, 'Documento médico não se descarta: fica guardado para sempre.')
        saem.add(sai)
      }
    }
    const quem = await nomeDe(pedido)
    const caso = ficha.processos[0]
    // A correção da classificação vale e fica no histórico, sem o conteúdo do documento (GGVP-95, CA2).
    for (const l of aConferir.filter((x) => escolhas.get(x.id)!.tipo !== x.tipo)) {
      l.sugerido = l.tipo
      ficha.historico.push(evento(`Corrigiu a classificação de ${l.arquivo}: a IA sugeriu ${nomeTipo(l.tipo)}; ficou ${nomeTipo(escolhas.get(l.id)!.tipo)}`, quem))
    }
    for (const l of aConferir) {
      const escolha = escolhas.get(l.id)!
      l.tipo = escolha.tipo
      l.data = escolha.data
      l.situacao = saem.has(l) ? 'descartado' : 'arquivado'
      l.arquivadoEm = agora().toISOString()
      const arquivo = ficha.arquivos.find((a) => a.nome === l.arquivo)
      if (arquivo) {
        // O contrato assinado já chega na subpasta do processo dele (GGVP-72, GGVP-77): fica lá, mesmo com outro caso aberto.
        const doProcesso = l.tipo === 'contrato' && ficha.processos.some((x) => x.id === arquivo.local)
        const local = doProcesso ? arquivo.local : localDoTipo(l.tipo, caso?.id)
        if (local !== arquivo.local) {
          arquivo.nome = nomeSemSobrescrever(arquivo.nome, ficha.arquivos.filter((a) => a.local === local).map((a) => a.nome))
          l.arquivo = arquivo.nome
        }
        Object.assign(arquivo, { tipo: l.tipo, local, aguardaLeitura: false, repetido: arquivo.repetido || saem.has(l) })
      }
      await guardarLeitura(l)
    }
    const arquivados = aConferir.filter((l) => l.situacao === 'arquivado')
    const tipos = [...new Set(arquivados.map((l) => nomeTipo(l.tipo)))].join(', ')
    const descarte = saem.size > 0 ? `; descartou ${saem.size === 1 ? '1 cópia menos legível' : `${saem.size} cópias menos legíveis`} (o original fica guardado)` : ''
    const registro = evento(`Arquivou ${documentos(arquivados.length)} lidos pela IA (${tipos})${descarte}; conferiu a leitura`, quem)
    ficha.historico.push(registro)
    const contratosLidos = arquivados.filter((l) => l.tipo === 'contrato')
    if (contratosLidos.length > 0) ficha.historico.push(evento('O contrato assinado segue para a verificação do contrato (D1.19)', quem))
    await guardar(ficha)
    // O contrato do caso esperava esta leitura: ela decide entre a conferência e a cópia (GGVP-85).
    for (const processoId of new Set(contratosLidos.map((l) => ficha.arquivos.find((a) => a.nome === l.arquivo)?.local ?? ''))) await lerContrato(processoId)
    return {
      arquivados: arquivados.length,
      descartados: saem.size,
      contrato: contratosLidos.length > 0,
      processoId: caso?.id,
      evento: registro,
      ficha: await fichaPeloId(ficha.id),
      leituras: await leiturasDe(ficha.id),
      contratos: await contratosDe(ficha.id),
    }
  })

  // GGVP-81 CA10: "É deste cliente": a pessoa conferiu e o documento em quarentena volta à conferência.
  app.post<{ Params: { id: string } }>('/api/documentos-lidos/:id/liberar', editar, async (pedido, resposta) => {
    const achado = await leituraEFicha(pedido.params.id)
    if (!achado) return negar(resposta, 404, 'Documento não encontrado.')
    const { doc, ficha } = achado
    if (doc.situacao !== 'quarentena') return negar(resposta, 400, 'O documento não está em quarentena.')
    doc.situacao = 'a-conferir'
    ficha.historico.push(evento(`Conferiu o documento em quarentena (${nomeTipo(doc.tipo)}: ${doc.quarentena}): é deste cliente`, await nomeDe(pedido)))
    await guardarLeitura(doc)
    await guardar(ficha)
    return { documento: doc, ficha: await fichaPeloId(ficha.id) }
  })

  // GGVP-81 CA11: sem motivo, recusa; com motivo, muda de caso e registra nas duas fichas. Nada é apagado: o arquivo sai da
  // pasta de origem e entra na outra, para a leitura de lá.
  app.post<{ Params: { id: string } }>('/api/documentos-lidos/:id/mover', editar, async (pedido, resposta) => {
    const entrada = MudancaDeCaso.safeParse(pedido.body)
    if (!entrada.success || entrada.data.motivo.length < 3) return negar(resposta, 400, 'Informe o motivo para mover o documento.')
    const { processoId, motivo } = entrada.data
    const achado = await leituraEFicha(pedido.params.id)
    if (!achado) return negar(resposta, 404, 'Documento não encontrado.')
    const { doc, ficha } = achado
    if (!emConferencia(doc)) return negar(resposta, 400, 'Só se move documento que ainda está na conferência.')
    const destino = (await fichas()).find((f) => f.processos.some((x) => x.id === processoId))
    const caso = destino?.processos.find((x) => x.id === processoId)
    if (!destino || !caso) return negar(resposta, 404, 'Caso não encontrado.')
    const arquivo = ficha.arquivos.find((a) => a.nome === doc.arquivo)
    if (!arquivo) return negar(resposta, 404, 'Arquivo não encontrado na pasta.')
    const qual = nomeTipo(doc.tipo)
    const beneficio = nomeBeneficio(caso.beneficio)
    const quem = await nomeDe(pedido)
    let registro: EventoHistorico
    if (destino.id === ficha.id) {
      arquivo.local = localDoTipo(arquivo.tipo, caso.id)
      registro = evento(`Moveu ${qual} para o caso ${beneficio}. Motivo: ${motivo}`, quem)
      ficha.historico.push(registro)
      await guardar(ficha)
      return { evento: registro, ficha: await fichaPeloId(ficha.id), leituras: await leiturasDe(ficha.id) }
    }
    ficha.arquivos = ficha.arquivos.filter((a) => a !== arquivo)
    const local = localDoTipo(arquivo.tipo, caso.id)
    const nome = nomeSemSobrescrever(arquivo.nome, destino.arquivos.filter((a) => a.local === local).map((a) => a.nome))
    destino.arquivos.push({ ...arquivo, nome, local, aguardaLeitura: true })
    doc.situacao = 'movido'
    registro = evento(`Moveu ${qual} para o caso ${beneficio} de ${destino.nome}. Motivo: ${motivo}`, quem)
    ficha.historico.push(registro)
    destino.historico.push(evento(`Recebeu ${qual} vindo da pasta de ${ficha.nome}. Motivo: ${motivo}`, quem))
    await guardarLeitura(doc)
    await guardar(ficha)
    await guardar(destino)
    await lerArquivosNovos(destino)
    const leituras = [...(await leiturasDe(ficha.id)), ...(await leiturasDe(destino.id))]
    return { evento: registro, ficha: await fichaPeloId(ficha.id), destino: await fichaPeloId(destino.id), saiu: arquivo, leituras }
  })

  // GGVP-81 CA8: o cadastro só muda com a confirmação, campo a campo; o valor não vai ao histórico.
  app.post<{ Params: { id: string } }>('/api/documentos-lidos/:id/cadastro', editar, async (pedido, resposta) => {
    const entrada = CampoLidoNoCadastro.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Campo inválido.')
    const { campo } = entrada.data
    const achado = await leituraEFicha(pedido.params.id)
    if (!achado) return negar(resposta, 404, 'Documento não encontrado.')
    const { doc, ficha } = achado
    if (doc.situacao === 'quarentena') return negar(resposta, 400, 'Documento em quarentena: confira de quem é antes.')
    const lido = doc.lidos[campo]
    if (!lido) return negar(resposta, 400, 'A IA não leu este dado.')
    if (campo === 'nome' && !validarNome(lido)) return negar(resposta, 400, 'Nome inválido.')
    if (campo === 'cpf') {
      if (!validarCpf(lido)) return negar(resposta, 400, 'CPF inválido.')
      const dono = fichaComCpf(await fichas(), lido)
      if (dono && dono.id !== ficha.id) return negar(resposta, 400, `Este CPF já está na ficha de ${dono.nome}.`)
    }
    ficha[campo] = campo === 'cpf' ? normalizarCpf(lido) : campo === 'rg' ? normalizarRg(lido) : lido
    ficha.historico.push(evento(`Atualizou o ${ROTULOS_DOS_CAMPOS[campo].toLowerCase()} do cadastro com o que a IA leu (${nomeTipo(doc.tipo)})`, await nomeDe(pedido)))
    await guardar(ficha)
    return { ficha: await fichaPeloId(ficha.id) }
  })
}
