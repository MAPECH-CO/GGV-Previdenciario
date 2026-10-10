// EXEMPLO. Servidor de exemplo da leitura e do arquivo dos documentos (GGVP-81), sobre o mesmo banco de servidor.ts.
// A IA é simulada: a pilha da Rita vem pronta (com duplicado, baixa confiança e um papel de outra pessoa) e o que chega
// pelo scanner ou pelo card da GGVP-17 ganha uma leitura simulada. Ligar no servidor: trocar o corpo de cada função por
// fetch no endpoint indicado (spec da ggvp-81), ler o que o n8n gravou no Drive e chamar a IA de verdade.
import { dataParaIso, normalizarCpf, validarCpf, validarNome } from '../campos.ts'
import { somarDias } from '../regras/agenda.ts'
import { normalizarRg } from '../regras/cadastro.ts'
import { localDoTipo, nomeSemSobrescrever } from '../regras/arquivos.ts'
import { fichasCitadas } from '../regras/busca.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { fichaComCpf } from '../regras/duplicidade.ts'
import {
  ROTULOS_DOS_CAMPOS,
  ehMedico,
  lerComIADeExemplo,
  menosLegivel,
  motivoDaQuarentena,
  quarentenaAntiga,
  type CampoLido,
  type DocumentoLido,
} from '../regras/leitura.ts'

// Os tipos da leitura e a leitura simulada moram em regras/leitura.ts (GGVP-125, bloco 5b), para o servidor usar os mesmos.
export type { DocumentoLido, SituacaoDoLido } from '../regras/leitura.ts'
import { TIPOS_DE_DOCUMENTO, nomeBeneficio, nomeTipo } from './catalogos.ts'
import { concluirLeituraDoContrato, leituraDeExemploDoContrato, obterContrato } from './contrato.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import { agora, doServidor, esperar, evento, gravar, ler, noBanco, receber, type Banco } from './servidor.ts'
import type { Contrato } from '../regras/contratoDoCaso.ts'
import type { Arquivo, EventoHistorico, Ficha, Processo, Tarefa } from './tipos.ts'

// Contrato (vai para packages/contratos/documentos.ts quando o GGVP-118 existir).

/** "Arquivar" (CA7, CA9). Só depois de "Conferi os documentos lidos pela IA". */
export type Arquivamento = {
  conferi: true
  /** Todos os documentos a conferir, com o tipo e a data que a pessoa confirmou ou trocou. */
  documentos: { id: string; tipo: string; data: string }[]
  /** A decisão sobre os duplicados que a IA apontou. Obrigatória quando há duplicado. */
  duplicados?: 'manter' | 'descartar'
}

export type RespostaArquivamento = {
  arquivados: number
  descartados: number
  /** Havia contrato assinado: o caso segue para a verificação do contrato (CA4, GGVP-85). */
  contrato: boolean
  processoId?: string
  evento: EventoHistorico
}

/** "Mover para outro caso" (CA11). O motivo é obrigatório. */
export type Mudanca = { processoId: string; motivo: string }

/** Um caso para onde o documento pode ir. */
export type Destino = { processoId: string; rotulo: string }

export type Conferencia = {
  ficha: Ficha
  /** O caso em andamento, quando há. */
  processo?: Processo
  /** A conferir e em quarentena. */
  documentos: DocumentoLido[]
  /** Os casos deste cliente e, para a quarentena, os do cliente que a IA leu no papel (CA11). */
  destinos: Destino[]
  /** A leitura falhou: o Atendimento pede o documento legível (GGVP-95, CA3). */
  ilegiveis: DocumentoLido[]
}

const documentos = (n: number) => (n === 1 ? '1 documento' : `${n} documentos`)

/** A pilha de exemplo da Rita, que o scanner guardou ontem: tem duplicado, baixa confiança e um CNIS de outra pessoa. */
function semearPilhaDaRita(banco: Banco, leituras: DocumentoLido[]) {
  const rita = banco.fichas.find((f) => f.id === 'rita-exemplo')
  if (!rita) return
  const ontem = somarDias(hojeIso(agora()), -1)
  const lidoEm = new Date(`${ontem}T17:40:00`).toISOString()
  const nome = (tipo: string, copia = '') => `${tipo} - Rita Exemplo - ${ontem}${copia}.pdf`
  const pilha: Omit<DocumentoLido, 'id' | 'fichaId' | 'origem' | 'situacao' | 'lidoEm'>[] = [
    { arquivo: nome('RG'), tipo: 'rg', data: '2015-03-10', confianca: 96, lidos: { nome: 'Rita de Cássia Exemplo', rg: '00.000.000-0' } },
    { arquivo: nome('Comprovante de residencia'), tipo: 'comprovante-residencia', data: '2026-09-12', confianca: 91, lidos: { nome: 'Rita Exemplo', endereco: 'Rua Exemplo, 100 · São Paulo/SP' } },
    { arquivo: nome('Comprovante de residencia', ' (2)'), tipo: 'comprovante-residencia', data: '2026-09-12', confianca: 74, lidos: { nome: 'Rita Exemplo', endereco: 'Rua Exemplo, 100 · São Paulo/SP' } },
    { arquivo: nome('Laudo medico'), tipo: 'laudo', data: '2026-08-20', confianca: 62, lidos: {}, emitente: 'Dra. Exemplo Neurologista', registro: 'CRM-SP 000000' },
    // A automação guardou na pasta da Rita porque a pilha era dela; a IA leu o nome e o CPF de outro cliente.
    { arquivo: nome('CNIS'), tipo: 'cnis', data: '2026-09-30', confianca: 88, lidos: { nome: 'Antônio Exemplo', cpf: CPF_DE_TESTE } },
  ]
  for (const p of pilha) {
    const id = `${rita.id}/${p.arquivo}`
    const quarentena = motivoDaQuarentena(p.lidos, rita)
    leituras.push({ ...p, id, fichaId: rita.id, origem: 'scanner', quarentena, situacao: quarentena ? 'quarentena' : 'a-conferir', lidoEm })
    rita.arquivos.push({ nome: p.arquivo, tipo: p.tipo, local: localDoTipo(p.tipo, rita.processos[0]?.id), data: ontem, origem: 'scanner', repetido: false, aguardaLeitura: true })
  }
  leituras.find((l) => l.arquivo === nome('Comprovante de residencia', ' (2)'))!.duplicadoDe = `${rita.id}/${nome('Comprovante de residencia')}`
}

/** As leituras do banco: nascem com a pilha da Rita, e a IA lê o que chegou e ainda não foi lido (CA1, CA2, CA13). */
export function leiturasDo(banco: Banco): DocumentoLido[] {
  if (!banco.leituras) {
    banco.leituras = []
    semearPilhaDaRita(banco, banco.leituras)
  }
  const leituras = banco.leituras
  for (const ficha of banco.fichas) {
    // As fichas do servidor são lidas lá (GGVP-125, bloco 5b): a leitura vem na cópia.
    if (doServidor(ficha.id)) continue
    for (const arquivo of ficha.arquivos) {
      if (arquivo.aguardaLeitura && !leituras.some((l) => l.id === `${ficha.id}/${arquivo.nome}`)) leituras.push(lerComIADeExemplo(ficha, arquivo, leituras, agora().toISOString()))
    }
  }
  return [...leituras, ...(banco.leiturasDoServidor ?? [])]
}

/** A leitura de uma ficha do servidor: o id é "<ficha>/<arquivo>" (GGVP-125, bloco 5b). */
const doServidorPelaLeitura = (documentoId: string) => doServidor(documentoId.slice(0, 36))
const rotaDaLeitura = (documentoId: string, acao: string) => `/documentos-lidos/${encodeURIComponent(documentoId)}/${acao}`

/** O banco com as leituras em dia, já gravado. */
function lerComLeituras(): { banco: Banco; leituras: DocumentoLido[] } {
  const banco = ler()
  const leituras = leiturasDo(banco)
  gravar(banco)
  return { banco, leituras }
}

const emConferencia = (l: DocumentoLido) => l.situacao === 'a-conferir' || l.situacao === 'quarentena'

const rotuloDoCaso = (ficha: Ficha, p: Processo) => `${ficha.nome} · ${nomeBeneficio(p.beneficio)}${p.numero ? ` · ${p.numero}` : ''}`

/** GET /api/fichas/:id/documentos-lidos */
export async function documentosLidos(fichaId: string): Promise<Conferencia | null> {
  if (doServidor(fichaId)) {
    const r = await noBanco<Conferencia>(`/fichas/${fichaId}/documentos-lidos`)
    return { ...r, ficha: receber({ ficha: r.ficha, leituras: [...r.documentos, ...r.ilegiveis] }) ?? r.ficha }
  }
  const { banco, leituras } = lerComLeituras()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) return null
  const docs = leituras.filter((l) => l.fichaId === fichaId && emConferencia(l))
  // Para a quarentena, os casos do cliente cujo nome ou CPF a IA leu no papel.
  const donos = docs
    .filter((l) => l.situacao === 'quarentena')
    .flatMap((l) => [fichaComCpf(banco.fichas, l.lidos.cpf), ...fichasCitadas(banco.fichas, l.lidos.nome ?? '')])
    .filter((f): f is Ficha => f !== undefined && f.id !== fichaId)
  const fichas = [ficha, ...new Set(donos)]
  return {
    ficha,
    processo: ficha.processos[0],
    documentos: docs,
    destinos: fichas.flatMap((f) => f.processos.map((p) => ({ processoId: p.id, rotulo: rotuloDoCaso(f, p) }))),
    ilegiveis: leituras.filter((l) => l.fichaId === fichaId && ilegivelEmAberto(l, leituras)),
  }
}

const dataValida = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && dataParaIso(iso.split('-').reverse().join('/')) === iso

/** POST /api/fichas/:id/documentos-lidos/arquivar (CA4, CA7, CA9, CA16). */
export async function arquivarDocumentos(fichaId: string, pedido: Arquivamento): Promise<RespostaArquivamento> {
  if (!doServidor(fichaId)) await esperar()
  if (pedido.conferi !== true) throw new Error('Confira os documentos lidos pela IA')
  if (doServidor(fichaId)) {
    // GGVP-125, bloco 5b: o servidor arquiva e leva o contrato assinado à verificação; a cópia recebe a ficha, as leituras e os contratos.
    const r = await noBanco<RespostaArquivamento & { ficha: Ficha; leituras: DocumentoLido[]; contratos: Contrato[] }>(`/fichas/${fichaId}/documentos-lidos/arquivar`, {
      method: 'POST',
      corpo: pedido,
    })
    receber({ ficha: r.ficha, leituras: r.leituras, contratos: r.contratos })
    return { arquivados: r.arquivados, descartados: r.descartados, contrato: r.contrato, processoId: r.processoId, evento: r.evento }
  }
  const { banco, leituras } = lerComLeituras()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const aConferir = leituras.filter((l) => l.fichaId === fichaId && l.situacao === 'a-conferir')
  if (aConferir.length === 0) throw new Error('Nenhum documento para arquivar')
  const escolhas = new Map(pedido.documentos.map((d) => [d.id, d]))
  if (escolhas.size !== aConferir.length || aConferir.some((l) => !escolhas.has(l.id))) throw new Error('A conferência mudou: abra a tela de novo')
  for (const d of pedido.documentos) {
    if (!TIPOS_DE_DOCUMENTO.some((t) => t.id === d.tipo) || !dataValida(d.data)) throw new Error('Tipo ou data inválidos')
  }

  // Duplicados: a pessoa decide; o sistema não descarta sozinho (CA9). Documento médico nunca sai (CA16).
  const copias = aConferir.filter((l) => l.duplicadoDe)
  if (copias.length > 0 && !pedido.duplicados) throw new Error('Decida o que fazer com o documento duplicado')
  const saem = new Set<DocumentoLido>()
  if (pedido.duplicados === 'descartar') {
    for (const copia of copias) {
      const original = leituras.find((l) => l.id === copia.duplicadoDe)
      const sai = original?.situacao === 'a-conferir' ? menosLegivel(original, copia) : copia
      if (ehMedico(escolhas.get(sai.id)?.tipo ?? sai.tipo)) throw new Error('Documento médico não se descarta: fica guardado para sempre')
      saem.add(sai)
    }
  }

  const caso = ficha.processos[0]
  // A correção da classificação vale e fica no histórico, sem o conteúdo do documento (GGVP-95, CA2).
  const correcoes = aConferir.filter((l) => escolhas.get(l.id)!.tipo !== l.tipo)
  for (const l of correcoes) {
    l.sugerido = l.tipo
    ficha.historico.push(evento(`Corrigiu a classificação de ${l.arquivo}: a IA sugeriu ${nomeTipo(l.tipo)}; ficou ${nomeTipo(escolhas.get(l.id)!.tipo)}`))
  }
  for (const l of aConferir) {
    const escolha = escolhas.get(l.id)!
    l.tipo = escolha.tipo
    l.data = escolha.data
    l.situacao = saem.has(l) ? 'descartado' : 'arquivado'
    l.arquivadoEm = agora().toISOString()
    const arquivo = ficha.arquivos.find((a) => a.nome === l.arquivo)
    if (!arquivo) continue
    // O contrato assinado já chega na subpasta do processo dele (GGVP-72, GGVP-77): fica lá, mesmo com outro caso aberto.
    const doProcesso = l.tipo === 'contrato' && ficha.processos.some((p) => p.id === arquivo.local)
    const local = doProcesso ? arquivo.local : localDoTipo(l.tipo, caso?.id)
    if (local !== arquivo.local) {
      arquivo.nome = nomeSemSobrescrever(arquivo.nome, ficha.arquivos.filter((a) => a.local === local).map((a) => a.nome))
      l.arquivo = arquivo.nome
    }
    Object.assign(arquivo, { tipo: l.tipo, local, aguardaLeitura: false, repetido: arquivo.repetido || saem.has(l) })
  }

  const arquivados = aConferir.filter((l) => l.situacao === 'arquivado')
  const tipos = [...new Set(arquivados.map((l) => nomeTipo(l.tipo)))].join(', ')
  const descarte = saem.size > 0 ? `; descartou ${saem.size === 1 ? '1 cópia menos legível' : `${saem.size} cópias menos legíveis`} (o original fica guardado)` : ''
  const registro = evento(`Arquivou ${documentos(arquivados.length)} lidos pela IA (${tipos})${descarte}; conferiu a leitura`)
  ficha.historico.push(registro)
  const contratosLidos = arquivados.filter((l) => l.tipo === 'contrato')
  const contrato = contratosLidos.length > 0
  if (contrato) ficha.historico.push(evento('O contrato assinado segue para a verificação do contrato (D1.19)'))
  gravar(banco)
  // O contrato do caso esperava esta leitura: ela decide entre a conferência e a cópia (GGVP-85).
  for (const processoId of new Set(contratosLidos.map((l) => ficha.arquivos.find((a) => a.nome === l.arquivo)?.local ?? ''))) {
    const doCaso = await obterContrato(processoId)
    if (doCaso?.contrato.etapa === 'leitura') await concluirLeituraDoContrato(processoId, leituraDeExemploDoContrato(doCaso.contrato))
  }
  return { arquivados: arquivados.length, descartados: saem.size, contrato, processoId: caso?.id, evento: registro }
}

function documentoDe(banco: Banco, leituras: DocumentoLido[], documentoId: string) {
  const doc = leituras.find((l) => l.id === documentoId)
  const ficha = doc && banco.fichas.find((f) => f.id === doc.fichaId)
  if (!doc || !ficha) throw new Error('Documento não encontrado')
  return { doc, ficha }
}

/** POST /api/documentos-lidos/:id/cadastro. O cadastro só muda com a confirmação, campo a campo (CA8). */
export async function usarNoCadastro(documentoId: string, campo: CampoLido): Promise<Ficha> {
  if (doServidorPelaLeitura(documentoId)) {
    const r = await noBanco<{ ficha: Ficha }>(rotaDaLeitura(documentoId, 'cadastro'), { method: 'POST', corpo: { campo } })
    return receber(r) ?? r.ficha
  }
  await esperar()
  const { banco, leituras } = lerComLeituras()
  const { doc, ficha } = documentoDe(banco, leituras, documentoId)
  if (doc.situacao === 'quarentena') throw new Error('Documento em quarentena: confira de quem é antes')
  const lido = doc.lidos[campo]
  if (!lido) throw new Error('A IA não leu este dado')
  if (campo === 'nome' && !validarNome(lido)) throw new Error('Nome inválido')
  if (campo === 'cpf') {
    if (!validarCpf(lido)) throw new Error('CPF inválido')
    const dono = fichaComCpf(banco.fichas, lido)
    if (dono && dono.id !== ficha.id) throw new Error(`Este CPF já está na ficha de ${dono.nome}`)
  }
  ficha[campo] = campo === 'cpf' ? normalizarCpf(lido) : campo === 'rg' ? normalizarRg(lido) : lido
  // O valor não vai para o histórico: só o que mudou e de onde veio.
  ficha.historico.push(evento(`Atualizou o ${ROTULOS_DOS_CAMPOS[campo].toLowerCase()} do cadastro com o que a IA leu (${nomeTipo(doc.tipo)})`))
  gravar(banco)
  return ficha
}

/** POST /api/documentos-lidos/:id/liberar. "É deste cliente": a pessoa conferiu e o documento volta à conferência (CA10). */
export async function liberarDaQuarentena(documentoId: string): Promise<DocumentoLido> {
  if (doServidorPelaLeitura(documentoId)) {
    const r = await noBanco<{ documento: DocumentoLido; ficha: Ficha }>(rotaDaLeitura(documentoId, 'liberar'), { method: 'POST' })
    receber({ ficha: r.ficha, leituras: [r.documento] })
    return r.documento
  }
  await esperar()
  const { banco, leituras } = lerComLeituras()
  const { doc, ficha } = documentoDe(banco, leituras, documentoId)
  if (doc.situacao !== 'quarentena') throw new Error('O documento não está em quarentena')
  doc.situacao = 'a-conferir'
  ficha.historico.push(evento(`Conferiu o documento em quarentena (${nomeTipo(doc.tipo)}: ${doc.quarentena}): é deste cliente`))
  gravar(banco)
  return doc
}

/** POST /api/documentos-lidos/:id/mover. Sem motivo, o servidor recusa; com motivo, muda e registra nas duas fichas (CA11). */
export async function moverDocumento(documentoId: string, mudanca: Mudanca): Promise<{ evento: EventoHistorico }> {
  if (!doServidorPelaLeitura(documentoId)) await esperar()
  const motivo = mudanca.motivo?.trim() ?? ''
  if (motivo.length < 3) throw new Error('Informe o motivo para mover o documento')
  if (doServidorPelaLeitura(documentoId)) {
    const r = await noBanco<{ evento: EventoHistorico; ficha: Ficha; destino?: Ficha; saiu?: Arquivo; leituras: DocumentoLido[] }>(rotaDaLeitura(documentoId, 'mover'), {
      method: 'POST',
      corpo: { processoId: mudanca.processoId, motivo },
    })
    receber({ ficha: r.ficha, leituras: r.leituras })
    if (r.destino) receber({ ficha: r.destino })
    if (r.saiu) {
      // A cópia daqui guarda o que só ela tem: o arquivo que saiu da pasta de origem sai daqui também.
      const banco = ler()
      const origem = banco.fichas.find((f) => f.id === r.ficha.id)
      if (origem) origem.arquivos = origem.arquivos.filter((a) => !(a.nome === r.saiu!.nome && a.local === r.saiu!.local))
      gravar(banco)
    }
    return { evento: r.evento }
  }
  const { banco, leituras } = lerComLeituras()
  const { doc, ficha } = documentoDe(banco, leituras, documentoId)
  if (!emConferencia(doc)) throw new Error('Só se move documento que ainda está na conferência')
  const destino = banco.fichas.find((f) => f.processos.some((p) => p.id === mudanca.processoId))
  const caso = destino?.processos.find((p) => p.id === mudanca.processoId)
  if (!destino || !caso) throw new Error('Caso não encontrado')
  const arquivo = ficha.arquivos.find((a) => a.nome === doc.arquivo)
  if (!arquivo) throw new Error('Arquivo não encontrado na pasta')
  const qual = nomeTipo(doc.tipo)
  const beneficio = nomeBeneficio(caso.beneficio)

  let registro: EventoHistorico
  if (destino.id === ficha.id) {
    arquivo.local = localDoTipo(arquivo.tipo, caso.id)
    registro = evento(`Moveu ${qual} para o caso ${beneficio}. Motivo: ${motivo}`)
    ficha.historico.push(registro)
  } else {
    // Muda de pasta: sai da ficha de origem e entra na outra, para a leitura de lá (nada é apagado).
    ficha.arquivos = ficha.arquivos.filter((a) => a !== arquivo)
    const local = localDoTipo(arquivo.tipo, caso.id)
    const nome = nomeSemSobrescrever(arquivo.nome, destino.arquivos.filter((a) => a.local === local).map((a) => a.nome))
    destino.arquivos.push({ ...arquivo, nome, local, aguardaLeitura: true })
    doc.situacao = 'movido'
    registro = evento(`Moveu ${qual} para o caso ${beneficio} de ${destino.nome}. Motivo: ${motivo}`)
    ficha.historico.push(registro)
    destino.historico.push(evento(`Recebeu ${qual} vindo da pasta de ${ficha.nome}. Motivo: ${motivo}`))
  }
  gravar(banco)
  return { evento: registro }
}

/** GET /api/relatorios/quarentena. Os documentos em quarentena há mais de um dia (CA12, proposta). */
export function relatorioDeQuarentena(): { documento: DocumentoLido; cliente: string }[] {
  const { banco, leituras } = lerComLeituras()
  return quarentenaAntiga(leituras, agora()).map((documento) => ({
    documento,
    cliente: banco.fichas.find((f) => f.id === documento.fichaId)?.nome ?? '',
  }))
}

/** "Conferir documento" na Central do Atendimento, onde a Documentação trabalha: uma por cliente com leitura a conferir. */
export function tarefasDeConferirDocumento(): Tarefa[] {
  const { banco, leituras } = lerComLeituras()
  return banco.fichas.flatMap((ficha) => {
    const docs = leituras.filter((l) => l.fichaId === ficha.id && emConferencia(l))
    if (docs.length === 0) return []
    const quarentena = docs.filter((l) => l.situacao === 'quarentena').length
    const caso = ficha.processos[0]
    const origem = docs.some((l) => l.origem === 'scanner') ? 'scanner' : 'card'
    return [
      {
        id: `conferir-${ficha.id}`,
        codigo: 'D1.18',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Conferir documento',
        detalhe: [
          caso ? nomeBeneficio(caso.beneficio) : 'sem caso em andamento',
          `${documentos(docs.length)} lidos pela IA`,
          quarentena > 0 ? `${quarentena} em quarentena` : '',
          origem === 'scanner' ? 'scanner' : 'anexado ao card',
        ]
          .filter(Boolean)
          .join(' · '),
        prazo: 'hoje',
        urgente: quarentena > 0,
        href: `/clientes/${ficha.id}/conferir-documentos`,
        processoId: caso?.id,
      },
    ]
  })
}

/**
 * Ilegível ainda em aberto: nenhum documento legível do mesmo tipo chegou depois, para a mesma ficha (GGVP-95, CA3).
 * Quando chega, a pendência sai sozinha.
 */
function ilegivelEmAberto(l: DocumentoLido, leituras: DocumentoLido[]): boolean {
  return l.situacao === 'ilegivel' && !leituras.some((o) => o.fichaId === l.fichaId && o.tipo === l.tipo && o.situacao !== 'ilegivel' && o.lidoEm > l.lidoEm)
}

/** "Pedir documento legível" na Central do Atendimento: um por documento cuja leitura falhou (GGVP-95, CA3). */
export function tarefasDePedirLegivel(): Tarefa[] {
  const { banco, leituras } = lerComLeituras()
  const hoje = hojeIso(agora())
  return leituras
    .filter((l) => ilegivelEmAberto(l, leituras))
    .flatMap((l) => {
      const ficha = banco.fichas.find((f) => f.id === l.fichaId)
      if (!ficha) return []
      return [
        {
          id: `legivel-${l.id}`,
          codigo: 'D1.18',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Pedir documento legível',
          detalhe: `${nomeTipo(l.tipo)} de ${dataCurta(hojeIso(new Date(l.lidoEm)), hoje)} · a leitura falhou: pedir o reenvio legível ao cliente`,
          prazo: 'hoje',
          href: `/clientes/${ficha.id}`,
          processoId: ficha.processos[0]?.id,
        },
      ]
    })
}
