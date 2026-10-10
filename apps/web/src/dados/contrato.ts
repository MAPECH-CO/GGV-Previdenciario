// EXEMPLO. Servidor de exemplo do contrato do caso (GGVP-65 em diante), sobre o mesmo banco de servidor.ts. Um contrato por
// processo: o kit, o preenchimento, a assinatura, a conferência e a cópia. Ligar no servidor: trocar o corpo de cada função
// por fetch no endpoint indicado na spec da história, sobre o mesmo contrato. ZapSign, Drive, Chatwoot e IA são simulados.
import { baixarApi } from '../api.ts'
import { dataParaIso, normalizarData, normalizarNome } from '../campos.ts'
import { problemaDoArquivo } from '../regras/arquivos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { fichaComCpf } from '../regras/duplicidade.ts'
import {
  CONFERENCIAS,
  NOMES_DOS_CANAIS,
  SEM_CONDICOES,
  TENTATIVAS_DE_ASSINATURA,
  cobrancaDaAssinatura,
  datasDoKit,
  entrevistaDoCaso,
  papelNaHora,
  precisaConferir,
  resumoDaLeitura,
  motivoParadoDaVerificacao,
  errosDaVisita,
  motivoParadoDaEntrega,
  type ValoresDaEntrega,
  mensagemDoLink,
  erroDoCampo,
  faltando,
  identificadorDoKit,
  identificadorDoModelo,
  linhaDoBeneficio,
  montarKit,
  modeloDoKit,
  normalizarCampo,
  restosDoModelo,
  ROTULOS_DOS_CAMPOS,
  type CampoDoModelo,
  type CanalDaTentativa,
  type CondicoesDoKit,
  type DadosDoContrato,
  type LeituraDoContrato,
} from '../regras/contrato.ts'
import { BENEFICIOS, nomeBeneficio } from './catalogos.ts'
import {
  CLIENTE_DO_EXEMPLO_DOS_MODELOS,
  ROTULOS_DAS_CONDICOES,
  camposDoCaso,
  contratosDeExemplo,
  daFicha,
  juntar,
  leituraDeExemploDoContrato,
  linkDoZapSign,
  textosDoKit,
  visitaDaCopia,
  type Assinatura,
  type Contrato,
  type ContratoDoCaso,
  type EnvioDoContrato,
  type EtapaDoContrato,
  type RespostaGerar,
} from '../regras/contratoDoCaso.ts'
import { QUEM, agora, doServidor, esperar, evento, gravar, ler, noBanco, receber, type Banco } from './servidor.ts'
import type { Agendamento, Arquivo, Ficha, Processo, Tarefa, TarefaEncaminhada } from './tipos.ts'

// Os tipos e as regras puras do contrato moram em regras/contratoDoCaso.ts (GGVP-125, bloco 4a).
export { CLIENTE_DO_EXEMPLO_DOS_MODELOS, camposDoCaso, contratosDeExemplo, leituraDeExemploDoContrato, visitaDaCopia }
export type { Assinatura, Contrato, ContratoDoCaso, DocumentoGerado, EnvioDoContrato, EtapaDoContrato, RespostaGerar, TentativaDeAssinatura } from '../regras/contratoDoCaso.ts'

/** Os contratos do banco, começando da semente quando o banco ainda não tem. */
export function contratos(banco: Banco): Contrato[] {
  banco.contratos ??= contratosDeExemplo(banco.fichas, hojeIso(agora()))
  return banco.contratos
}

function achar(banco: Banco, processoId: string): ContratoDoCaso | null {
  const contrato = contratos(banco).find((c) => c.processoId === processoId)
  const ficha = banco.fichas.find((f) => f.id === contrato?.fichaId)
  const processo = ficha?.processos.find((p) => p.id === processoId)
  return contrato && ficha && processo ? { ficha, processo, contrato } : null
}

/** A tarefa do Atendimento em cada etapa. Na leitura do contrato assinado, quem trabalha é a Documentação (GGVP-81). */
const TITULOS: Partial<Record<EtapaDoContrato, { codigo: string; acao: string; rota: string }>> = {
  preparar: { codigo: 'D1.16', acao: 'Preparar contrato', rota: 'preparar' },
  assinatura: { codigo: 'D1.17', acao: 'Colher assinatura', rota: 'assinatura' },
  conferir: { codigo: 'D1.19', acao: 'Conferir contrato', rota: 'conferir' },
  copia: { codigo: 'D1.20', acao: 'Entregar cópia do contrato', rota: 'copia' },
}

/** O detalhe e o prazo da tarefa "Entregar cópia do contrato" (GGVP-89, CA2). */
function andamentoDaCopia(ficha: Ficha, contrato: Contrato, hoje: string): { detalhe: string[]; prazo?: string; urgente?: boolean } {
  const assinadoEm = contrato.assinatura?.assinadoEm
  const visita = visitaDaCopia(ficha, contrato)
  return {
    detalhe: [
      ...(assinadoEm ? [`contrato assinado em ${dataCurta(hojeIso(new Date(assinadoEm)), hoje)}`] : []),
      ...(visita ? [`retirada ${visita.data === hoje ? 'hoje' : dataCurta(visita.data, hoje)} às ${visita.hora}`] : []),
    ],
    prazo: visita && visita.data !== hoje ? dataCurta(visita.data, hoje) : 'hoje',
    urgente: visita?.data === hoje,
  }
}

/** O detalhe e o prazo da tarefa "Colher assinatura": o status do ZapSign, a tentativa e o lembrete (GGVP-72, CA2 e CA4). */
function andamentoDaAssinatura(a: Assinatura | undefined, hoje: string): { detalhe: string[]; prazo?: string; urgente?: boolean } {
  if (a?.forma === 'papel' && !a.zapsign) {
    return {
      detalhe: [a.arquivo ? 'papel · digitalizado, falta concluir' : a.impressoEm ? 'papel · impresso, falta digitalizar o assinado' : 'papel · imprimir o kit'],
      prazo: 'hoje',
    }
  }
  if (!a?.zapsign) return { detalhe: [a?.erro ? 'erro ao gerar no ZapSign: tente de novo' : 'escolher como o cliente vai assinar'], urgente: a?.erro !== undefined }
  const cobranca = cobrancaDaAssinatura(a.tentativas, hoje)
  const enviado = a.tentativas[0]
  return {
    detalhe: [
      enviado ? `ZapSign enviado ${dataCurta(enviado.data, hoje)}` : 'ZapSign gerado · link ainda não enviado',
      ...(cobranca.feitas > 0 ? [`tentativa ${cobranca.feitas} de ${TENTATIVAS_DE_ASSINATURA}`] : []),
    ],
    prazo: !enviado ? 'enviar o link' : cobranca.lembrar ? 'tentar contato hoje' : cobranca.proximaEm ? `nova tentativa ${dataCurta(cobranca.proximaEm, hoje)}` : undefined,
    urgente: !enviado || cobranca.lembrar,
  }
}

/** A tarefa do Atendimento em cada etapa do contrato (título da lista fixa: "nome · Preparar contrato"). */
export function tarefasDoContrato(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  return contratos(banco).flatMap((c): Tarefa[] => {
    const achado = achar(banco, c.processoId)
    const titulo = TITULOS[c.etapa]
    if (!achado || !titulo || c.assinatura?.naSenior) return []
    const { ficha, processo } = achado
    const modelo = c.kit ? (modeloDoKit(c.kit)?.nome ?? 'sem modelo') : ''
    const base = { detalhe: [c.kit ? `kit ${c.kit.nome} · ${modelo}` : 'benefício sem kit cadastrado'], prazo: processo.prazo ?? 'hoje', urgente: processo.urgente }
    const andamento =
      c.etapa === 'assinatura'
        ? andamentoDaAssinatura(c.assinatura, hoje)
        : c.etapa === 'conferir' && c.leitura
          ? { detalhe: [resumoDaLeitura(c.leitura)], prazo: 'hoje', urgente: false }
          : c.etapa === 'copia'
            ? andamentoDaCopia(ficha, c, hoje)
            : c.etapa === 'preparar' && c.anteriores?.length
              ? { ...base, detalhe: [`corrigir e reenviar: ${c.anteriores.at(-1)!.motivo}`], urgente: true }
              : base
    return [
      {
        id: `contrato-${c.processoId}`,
        codigo: titulo.codigo,
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: titulo.acao,
        detalhe: [nomeBeneficio(processo.beneficio), ...andamento.detalhe].join(' · '),
        prazo: andamento.prazo,
        urgente: andamento.urgente,
        href: `/contrato/${c.processoId}/${titulo.rota}`,
        processoId: c.processoId,
      },
    ]
  })
}

/** O arquivo que o servidor anexou entra na pasta da cópia daqui; a pasta de verdade é a do Drive (GGVP-125, bloco 4b). */
function anexarAqui(fichaId: string, arquivo: Arquivo) {
  const banco = ler()
  banco.fichas.find((f) => f.id === fichaId)?.arquivos.push(arquivo)
  gravar(banco)
}

/**
 * O contrato do servidor gera o Word do escritório (GGVP-136) e por isso pede mais campos (a nacionalidade, o que falta do
 * representante, o curatelado) que o de exemplo, que só simula o texto.
 */
export const kitDeVerdade = (processoId: string) => doServidor(processoId)

/** O que o servidor oferece ao contrato: o PDF do kit (há conversor) e a assinatura pelo celular (o ZapSign está contratado). */
export type ServicosDoContrato = { zapsign: boolean; pdf: boolean }

/**
 * GET /api/contrato/servicos (GGVP-136, CA5, CA8). O contrato de exemplo tem o ZapSign simulado e nenhum PDF; o do servidor
 * diz o que há. Sem o ZapSign contratado, a opção do celular não aparece e o papel vale para qualquer entrevista.
 */
export async function servicosDoContrato(processoId: string): Promise<ServicosDoContrato> {
  if (!doServidor(processoId)) return { zapsign: true, pdf: false }
  // Sem resposta, a tela segue em papel e em Word, que não dependem de nada: melhor que não abrir.
  return noBanco<ServicosDoContrato>('/contrato/servicos').catch(() => ({ zapsign: false, pdf: false }))
}

export type KitParaImprimir = { blob: Blob; nome: string; pdf: boolean }

/**
 * GET /api/processos/:id/contrato/kit (CA5): o kit gerado, para imprimir. O PDF, se o servidor converte; senão, o Word
 * preenchido. Se o conversor não responde (502), pede o Word: imprimir não fica parado por causa do conversor.
 */
export async function baixarKit(processoId: string): Promise<KitParaImprimir> {
  const caminho = `/processos/${processoId}/contrato/kit`
  let r = await baixarApi(caminho)
  if (!r.ok && r.status === 502) r = await baixarApi(`${caminho}?formato=docx`)
  if (!r.ok) throw new Error(r.erro)
  return { blob: r.blob, nome: r.nome, pdf: r.blob.type === 'application/pdf' }
}

/** GET /api/processos/:id/contrato. Nulo quando o processo não tem contrato. */
export async function obterContrato(processoId: string): Promise<ContratoDoCaso | null> {
  return achar(ler(), processoId)
}

/**
 * POST /api/fichas/:id/processos. O cliente fechou: o processo nasce com o kit do benefício e o Atendimento recebe
 * "Preparar contrato" (CA1). Quem já é cliente e fecha outro benefício ganha processo e kit novos, mesmo com os mesmos
 * documentos (CA9). Chamado pela definição do benefício na entrevista e pela nova demanda (GGVP-124).
 */
export async function fecharContrato(fichaId: string, beneficio: string): Promise<ContratoDoCaso> {
  if (!doServidor(fichaId)) await esperar()
  if (beneficio === 'nao-sei' || !BENEFICIOS.some((b) => b.id === beneficio)) throw new Error('Benefício fora do catálogo')
  if (doServidor(fichaId)) {
    // GGVP-125, bloco 4a: o caso nasce no banco do portal, com o contrato e o kit; a cópia daqui recebe os dois.
    const r = await noBanco<ContratoDoCaso>(`/fichas/${fichaId}/processos`, { method: 'POST', corpo: { beneficio } })
    return { ficha: receber(r)!, processo: r.processo, contrato: r.contrato }
  }
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const hoje = hojeIso(agora())
  if (ficha.situacao === 'lead') {
    ficha.situacao = 'cliente'
    ficha.desde = `${hoje.slice(5, 7)}/${hoje.slice(0, 4)}`
  }
  let n = ficha.processos.length + 1
  while (ficha.processos.some((p) => p.id === `${fichaId}-${n}`)) n += 1
  const processo: Processo = { id: `${fichaId}-${n}`, beneficio, etapa: 'Contrato · preparar', proximaAcao: 'preparar o contrato', prazo: 'hoje' }
  ficha.processos.push(processo)
  // "Tem representante legal" do cadastro do lead (GGVP-43) já marca o LOAS representado; a pessoa confere no preparo.
  const condicoes = { ...SEM_CONDICOES, representado: Boolean(ficha.representante?.nome) }
  const kit = montarKit(beneficio, condicoes)
  const contrato: Contrato = { processoId: processo.id, fichaId, etapa: 'preparar', condicoes, kit, abertoEm: agora().toISOString() }
  contratos(banco).push(contrato)
  ficha.historico.push(
    evento(
      kit
        ? `Fechou ${nomeBeneficio(beneficio)}: processo novo com o kit ${kit.nome} (${kit.documentos.length} documentos, ${modeloDoKit(kit)?.nome ?? 'sem modelo'})`
        : `Fechou ${nomeBeneficio(beneficio)}: processo novo, sem kit cadastrado para o benefício`,
    ),
  )
  gravar(banco)
  return { ficha, processo, contrato }
}

/** PUT /api/processos/:id/contrato/condicoes. As condições do LOAS montam o kit de novo (CA2, CA8). */
export async function salvarCondicoes(processoId: string, condicoes: CondicoesDoKit): Promise<Contrato> {
  if (doServidor(processoId)) {
    const r = await noBanco<{ contrato: Contrato; ficha: Ficha }>(`/processos/${processoId}/contrato/condicoes`, { method: 'PUT', corpo: condicoes })
    receber(r)
    return r.contrato
  }
  await esperar()
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { ficha, processo, contrato } = achado
  if (contrato.etapa !== 'preparar') throw new Error('O kit só muda antes de gerar o contrato')
  contrato.condicoes = { ...condicoes }
  contrato.kit = montarKit(processo.beneficio, condicoes)
  const marcadas = (Object.keys(ROTULOS_DAS_CONDICOES) as (keyof CondicoesDoKit)[]).filter((k) => condicoes[k]).map((k) => ROTULOS_DAS_CONDICOES[k])
  ficha.historico.push(evento(`Condições do kit de ${nomeBeneficio(processo.beneficio)}: ${marcadas.length ? marcadas.join(', ') : 'nenhuma'}`))
  gravar(banco)
  return contrato
}

// GGVP-69 · preencher o contrato pelo modelo e conferir.

/**
 * POST /api/processos/:id/contrato/gerar. Valida de novo a decisão, o que corrigir e as quatro conferências (CA6). Com
 * "Não, corrigir campos", grava a correção (na ficha os dados pessoais; no contrato o RG, a parte contrária e o
 * representante), registra no histórico (CA7) e gera de novo (CA3). Campo obrigatório vazio não segue (CA7); sobra do
 * modelo também não (CA8). Gerado, o contrato vai para "Colher assinatura".
 */
export async function gerarContrato(processoId: string, envio: EnvioDoContrato): Promise<RespostaGerar> {
  await esperar()
  const oQueCorrigir = envio.oQueCorrigir?.trim() ?? ''
  if (CONFERENCIAS.some((c) => envio.conferencias[c.id] !== true)) throw new Error('Faltam conferências')
  if (!envio.aprovados && (oQueCorrigir.length < 3 || oQueCorrigir.length > 500)) throw new Error('Escreva o que corrigir')
  const correcoes = envio.aprovados ? {} : envio.correcoes
  for (const [campo, valor] of Object.entries(correcoes) as [CampoDoModelo, string][]) {
    if (campo === 'beneficio' || erroDoCampo(campo, valor)) throw new Error('Correção inválida')
  }
  if (doServidor(processoId)) {
    // GGVP-125, bloco 4a: o servidor confere de novo e gera; a cópia daqui recebe a ficha corrigida e o contrato.
    const r = await noBanco<RespostaGerar & { ficha?: Ficha }>(`/processos/${processoId}/contrato/gerar`, {
      method: 'POST',
      corpo: { aprovados: envio.aprovados, oQueCorrigir: envio.oQueCorrigir, conferencias: envio.conferencias, correcoes },
    })
    if (r.resultado === 'gerado') receber({ ficha: r.ficha, contrato: r.contrato })
    delete r.ficha
    return r
  }
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { ficha, processo, contrato } = achado
  if (contrato.etapa !== 'preparar' || !contrato.kit) throw new Error('Este contrato não está para preparar')
  const modelo = modeloDoKit(contrato.kit)
  if (!modelo) return { resultado: 'sem-modelo' }

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
  const dono = fichaComCpf(banco.fichas.filter((f) => f.id !== ficha.id), ficha.cpf)
  if (dono) return { resultado: 'cpf-de-outra-ficha', nome: dono.nome }
  contrato.dados = dados
  contrato.corrigidos = [...new Set([...(contrato.corrigidos ?? []), ...mudou])]

  const campos = camposDoCaso({ ficha, processo, contrato })
  const faltam = faltando(campos)
  if (faltam.length > 0) return { resultado: 'faltam', campos: faltam }
  const textos = textosDoKit(contrato.kit, campos)
  const restos = [...new Set(textos.flatMap((t) => restosDoModelo(t.texto, CLIENTE_DO_EXEMPLO_DOS_MODELOS)))]
  if (restos.length > 0) return { resultado: 'sobrou-do-exemplo', restos }

  const geradoEm = agora().toISOString()
  const versao = (contrato.documento?.versao ?? 0) + 1
  const motivo = envio.aprovados ? `gerado pelo ${modelo.nome}` : `corrigido: ${oQueCorrigir}`
  contrato.documento = { versao, geradoEm, campos, textos }
  contrato.versoes = [...(contrato.versoes ?? []), { versao, geradoEm, motivo }]
  contrato.etapa = 'assinatura'
  processo.etapa = 'Contrato · assinatura'
  processo.proximaAcao = 'colher a assinatura'
  if (mudou.length > 0) ficha.historico.push(evento(`Corrigiu no contrato: ${juntar(mudou.map((c) => ROTULOS_DOS_CAMPOS[c]))} (${oQueCorrigir})`))
  ficha.historico.push(
    evento(
      `Gerou o contrato de ${nomeBeneficio(processo.beneficio)} pelo modelo ${identificadorDoModelo(modelo)} (versão ${versao}): conferiu os campos, ` +
        'as datas à mão, a ficha LOAS e a página do Código Penal',
    ),
  )
  gravar(banco)
  return { resultado: 'gerado', contrato }
}

// GGVP-72 · assinatura digital pelo ZapSign. Simulado: o ZapSign gera o documento e o link; o botão da tela faz o papel do
// retorno (webhook) que devolve o assinado.

/** EXEMPLO. O segredo que autentica o retorno do ZapSign simulado (CA7). O de verdade fica só no servidor. */
export const SEGREDO_DO_RETORNO_EXEMPLO = 'segredo-de-exemplo-do-zapsign'

let zapsignFalha = false

/** Para o teste: o ZapSign simulado falha ao gerar o documento (CA9). */
export function configurarZapSign(opcoes: { falhar: boolean }) {
  zapsignFalha = opcoes.falhar
}

export type RespostaDoEnvio = { resultado: 'gerado'; contrato: Contrato; mensagem: string } | { resultado: 'erro'; mensagem: string }

/**
 * POST /api/processos/:id/contrato/zapsign. O ZapSign monta o documento pelo modelo e devolve o link (CA1). Um documento por
 * kit: pedir de novo devolve o mesmo, sem duplicar (CA4, CA5). Falhou, a tarefa mostra a mensagem e deixa tentar de novo
 * (CA9). A mensagem do WhatsApp com o link sai pronta para conferir (CA12).
 */
export async function enviarParaAssinatura(processoId: string): Promise<RespostaDoEnvio> {
  if (doServidor(processoId)) {
    // GGVP-125, bloco 4b: o documento no ZapSign (simulado) nasce no servidor; a cópia daqui recebe o contrato.
    const r = await noBanco<{ contrato: Contrato; mensagem: string; ficha: Ficha }>(`/processos/${processoId}/contrato/zapsign`, { method: 'POST' })
    receber(r)
    return { resultado: 'gerado', contrato: r.contrato, mensagem: r.mensagem }
  }
  await esperar()
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { ficha, contrato } = achado
  if (contrato.etapa !== 'assinatura' || !contrato.kit) throw new Error('Este contrato não está para assinar')
  if (contrato.assinatura?.forma === 'papel' && contrato.assinatura.arquivo) throw new Error('O contrato assinado em papel já foi digitalizado')
  const assinatura: Assinatura = contrato.assinatura ?? { forma: 'digital', tentativas: [] }
  contrato.assinatura = assinatura
  if (!assinatura.zapsign) {
    if (zapsignFalha) {
      assinatura.erro = 'O ZapSign não respondeu ao gerar o documento. Nada foi enviado ao cliente.'
      ficha.historico.push(evento('Tentou gerar o documento no ZapSign: o ZapSign não respondeu'))
      gravar(banco)
      return { resultado: 'erro', mensagem: assinatura.erro }
    }
    // Um documento por kit; a versão corrigida (GGVP-85) é outro documento.
    const versao = contrato.documento?.versao ?? 1
    const documentoId = versao > 1 ? `zapsign-exemplo-${processoId}-v${versao}` : `zapsign-exemplo-${processoId}`
    assinatura.zapsign = { documentoId, link: linkDoZapSign(documentoId), status: 'enviado', criadoEm: agora().toISOString(), eventos: [] }
    assinatura.erro = undefined
    ficha.historico.push(evento(`Gerou o documento no ZapSign pelo modelo ${identificadorDoKit(contrato.kit)}: ${documentoId}`))
  }
  assinatura.forma = 'digital'
  gravar(banco)
  return { resultado: 'gerado', contrato, mensagem: mensagemDoLink(ficha.nome, assinatura.zapsign.link, assinatura.tentativas.length > 0) }
}

/**
 * POST /api/processos/:id/contrato/tentativas. Cada tentativa de contato fica com a data e o canal, e reenviar o link não cria
 * outro documento (CA5). A primeira é o link enviado; a próxima, 3 dias depois (CA2). Com a segunda sem assinatura, o limite
 * foi atingido: o caso sobe para a advogada sênior e sai da Central do Atendimento (G15, CA11).
 */
export async function registrarTentativaDeAssinatura(processoId: string, canal: CanalDaTentativa, mensagem?: string): Promise<Contrato> {
  if (!doServidor(processoId)) await esperar()
  if (!(canal in NOMES_DOS_CANAIS)) throw new Error('Canal inválido')
  if (canal === 'whatsapp' && !mensagem?.trim()) throw new Error('Escreva a mensagem')
  if (doServidor(processoId)) {
    // GGVP-125, bloco 4b: a tentativa e o limite (G15) no servidor; a tarefa da sênior vem de lá.
    const r = await noBanco<{ contrato: Contrato; ficha: Ficha; tarefas: TarefaEncaminhada[] }>(`/processos/${processoId}/contrato/tentativas`, {
      method: 'POST',
      corpo: { canal, mensagem },
    })
    receber(r)
    return r.contrato
  }
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { ficha, processo, contrato } = achado
  const a = contrato.assinatura
  if (!a?.zapsign || a.zapsign.status === 'assinado') throw new Error('Não há assinatura pendente no ZapSign')
  const hoje = hojeIso(agora())
  const cobranca = cobrancaDaAssinatura(a.tentativas, hoje)
  if (cobranca.noLimite || (cobranca.proximaEm !== undefined && hoje < cobranca.proximaEm)) throw new Error('Ainda não é dia de tentar de novo')
  a.tentativas.push({ data: hoje, quando: agora().toISOString(), canal, quem: QUEM })
  const n = a.tentativas.length
  const pelo = NOMES_DOS_CANAIS[canal]
  ficha.contatos.push({
    data: hoje,
    canal: pelo,
    texto: n === 1 ? 'Link do ZapSign enviado para assinar o contrato.' : `Lembrete da assinatura do contrato (tentativa ${n} de ${TENTATIVAS_DE_ASSINATURA}); o link é o mesmo.`,
  })
  ficha.historico.push(
    evento(
      n === 1
        ? `Enviou o link do ZapSign pelo ${pelo} (tentativa 1 de ${TENTATIVAS_DE_ASSINATURA})`
        : `Tentou contato de novo pelo ${pelo} (tentativa ${n} de ${TENTATIVAS_DE_ASSINATURA}), sem criar outro documento no ZapSign`,
    ),
  )
  if (n >= TENTATIVAS_DE_ASSINATURA) {
    a.naSenior = true
    const tarefa: TarefaEncaminhada = {
      id: `senior-assinatura-${processoId}`,
      codigo: 'D1.17',
      cliente: { id: ficha.id, nome: ficha.nome },
      acao: 'Colher assinatura · limite de tentativas',
      detalhe: `${nomeBeneficio(processo.beneficio)} · ${n} tentativas sem assinatura (G15) · o Atendimento tentou em ${a.tentativas.map((t) => dataCurta(t.data, hoje)).join(' e ')}`,
      prazo: 'hoje',
      urgente: true,
      href: `/contrato/${processoId}/assinatura`,
      processoId,
      setor: 'Jurídico',
    }
    banco.tarefas.push(tarefa)
    ficha.historico.push(evento(`Subiu para a advogada sênior: ${n} tentativas sem assinatura (G15)`))
  }
  gravar(banco)
  return contrato
}

/** POST /api/integracoes/zapsign/retorno: o que o ZapSign manda quando o documento muda. */
export type RetornoDoZapSign = { documentoId: string; eventoId: string; status: 'assinado'; segredo: string }

/**
 * O retorno do ZapSign, autenticado pelo segredo; o mesmo evento repetido não anexa duas vezes (CA7). Assinado, anexa no card
 * o arquivo final do ZapSign, com as evidências (CA10), que segue para a leitura (GGVP-81, CA3), e a tarefa de assinatura se
 * encerra sozinha (CA6), inclusive a da sênior.
 */
export async function receberRetornoDoZapSign(r: RetornoDoZapSign): Promise<{ resultado: 'anexado'; arquivo: Arquivo } | { resultado: 'repetido' }> {
  await esperar()
  if (r.segredo !== SEGREDO_DO_RETORNO_EXEMPLO) throw new Error('Retorno do ZapSign não autenticado')
  const banco = ler()
  const contrato = contratos(banco).find((c) => c.assinatura?.zapsign?.documentoId === r.documentoId)
  const achado = contrato ? achar(banco, contrato.processoId) : null
  const assinatura = contrato?.assinatura
  if (!achado || !contrato || !assinatura?.zapsign) throw new Error('Documento do ZapSign não encontrado')
  const { ficha, processo } = achado
  const z = assinatura.zapsign
  if (z.eventos.includes(r.eventoId) || z.status === 'assinado') {
    if (!z.eventos.includes(r.eventoId)) z.eventos.push(r.eventoId)
    gravar(banco)
    return { resultado: 'repetido' }
  }
  const hoje = hojeIso(agora())
  const arquivo: Arquivo = {
    nome: `Contrato assinado - ${ficha.nome} - ${hoje} (ZapSign, com evidências).pdf`,
    tipo: 'contrato',
    local: processo.id,
    data: hoje,
    origem: 'card',
    repetido: false,
    aguardaLeitura: true,
  }
  ficha.arquivos.push(arquivo)
  z.status = 'assinado'
  z.eventos.push(r.eventoId)
  assinatura.assinadoEm = agora().toISOString()
  assinatura.arquivo = arquivo.nome
  contrato.etapa = 'leitura'
  processo.etapa = `Contrato assinado em ${dataCurta(hoje, hoje)}`
  processo.proximaAcao = 'ler e arquivar o contrato assinado'
  for (const t of banco.tarefas) if (t.processoId === processo.id && t.acao.startsWith('Colher assinatura')) t.concluida = true
  ficha.historico.push(evento('O ZapSign devolveu o contrato assinado: anexado no card com as evidências da assinatura; segue para a leitura', 'ZapSign'))
  gravar(banco)
  return { resultado: 'anexado', arquivo }
}

/** EXEMPLO. O botão "Simular o retorno do ZapSign" faz o papel do webhook, com o segredo certo. */
export async function simularRetornoDoZapSign(processoId: string): Promise<{ resultado: 'anexado'; arquivo: Arquivo } | { resultado: 'repetido' }> {
  if (doServidor(processoId)) {
    // GGVP-125, bloco 4b: no servidor, o botão faz o papel do retorno; o segredo do retorno de verdade não vem à tela.
    const r = await noBanco<{ resultado: 'anexado' | 'repetido'; arquivo?: Arquivo; contrato: Contrato; ficha: Ficha; tarefas?: TarefaEncaminhada[] }>(
      `/processos/${processoId}/contrato/zapsign/retorno-simulado`,
      { method: 'POST' },
    )
    receber(r)
    if (r.resultado === 'repetido' || !r.arquivo) return { resultado: 'repetido' }
    anexarAqui(r.ficha.id, r.arquivo)
    return { resultado: 'anexado', arquivo: r.arquivo }
  }
  const documentoId = (await obterContrato(processoId))?.contrato.assinatura?.zapsign?.documentoId
  if (!documentoId) throw new Error('Não há documento no ZapSign')
  return receberRetornoDoZapSign({ documentoId, eventoId: `${documentoId}-assinado`, status: 'assinado', segredo: SEGREDO_DO_RETORNO_EXEMPLO })
}

// GGVP-77 · assinatura em papel na entrevista. A impressora e o scanner são simulados: a automação do balcão (n8n) guarda o
// PDF pesquisável na pasta do cliente.

/** Como foi a entrevista do caso: papel na hora só na presencial (CA4). */
export const entrevistaDoContrato = ({ ficha }: ContratoDoCaso) => entrevistaDoCaso(ficha.agendamentos)

function paraOPapel(banco: Banco, processoId: string): ContratoDoCaso & { assinatura: Assinatura } {
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { contrato } = achado
  if (contrato.etapa !== 'assinatura' || !contrato.kit) throw new Error('Este contrato não está para assinar')
  if (!papelNaHora(entrevistaDoContrato(achado))) throw new Error('Papel só na entrevista presencial: a assinatura vai pelo ZapSign')
  if (contrato.assinatura?.zapsign) throw new Error('O documento já foi para o ZapSign')
  contrato.assinatura = { ...(contrato.assinatura ?? { tentativas: [] }), forma: 'papel' }
  return { ...achado, assinatura: contrato.assinatura }
}

/**
 * POST /api/processos/:id/contrato/impressao. "Papel, na hora": o kit sai com as datas em branco para preencher à mão, menos o
 * contrato de honorários (CA1). Só na entrevista presencial (CA4), enquanto o ZapSign estiver contratado (GGVP-136). No
 * contrato do servidor, o arquivo vem de `baixarKit`; isto só registra que o kit foi impresso.
 */
export async function imprimirKit(processoId: string): Promise<{ contrato: Contrato; datas: { documento: string; data: string }[] }> {
  if (doServidor(processoId)) {
    const r = await noBanco<{ contrato: Contrato; datas: { documento: string; data: string }[]; ficha: Ficha }>(`/processos/${processoId}/contrato/impressao`, {
      method: 'POST',
    })
    receber(r)
    return { contrato: r.contrato, datas: r.datas }
  }
  await esperar()
  const banco = ler()
  const { ficha, contrato, assinatura } = paraOPapel(banco, processoId)
  assinatura.impressoEm = agora().toISOString()
  ficha.historico.push(evento(`Imprimiu o kit para assinar em papel na hora (${contrato.kit!.documentos.length} documentos, datas em branco menos a do contrato de honorários)`))
  gravar(banco)
  return { contrato, datas: datasDoKit(contrato.kit!, 'papel', hojeIso(agora())) }
}

/**
 * O que a automação do balcão faz quando o contrato assinado passa no scanner: guarda o PDF pesquisável na pasta do cliente e
 * o arquivo aparece no card, para a leitura (GGVP-81, CA2).
 */
export async function digitalizarContratoAssinado(processoId: string): Promise<Arquivo> {
  if (doServidor(processoId)) {
    const r = await noBanco<{ arquivo: Arquivo; contrato: Contrato; ficha: Ficha }>(`/processos/${processoId}/contrato/digitalizacao`, { method: 'POST' })
    receber(r)
    anexarAqui(r.ficha.id, r.arquivo)
    return r.arquivo
  }
  await esperar()
  const banco = ler()
  const { ficha, processo, assinatura } = paraOPapel(banco, processoId)
  if (!assinatura.impressoEm) throw new Error('Imprima o kit antes')
  if (assinatura.arquivo) throw new Error('O contrato assinado já foi digitalizado')
  const hoje = hojeIso(agora())
  const arquivo: Arquivo = {
    nome: `Contrato assinado - ${ficha.nome} - ${hoje} (papel, PDF pesquisável).pdf`,
    tipo: 'contrato',
    local: processo.id,
    data: hoje,
    origem: 'scanner',
    repetido: false,
    aguardaLeitura: true,
  }
  ficha.arquivos.push(arquivo)
  assinatura.arquivo = arquivo.nome
  ficha.historico.push(evento('Digitalizou o contrato assinado em papel: PDF pesquisável na pasta do cliente', 'Automação do balcão'))
  gravar(banco)
  return arquivo
}

/** POST /api/processos/:id/contrato/assinatura-em-papel. Só conclui com a digitalização do contrato assinado anexada (CA3). */
export async function concluirAssinaturaEmPapel(processoId: string): Promise<Contrato> {
  if (doServidor(processoId)) {
    const r = await noBanco<{ contrato: Contrato; ficha: Ficha }>(`/processos/${processoId}/contrato/assinatura-em-papel`, { method: 'POST' })
    receber(r)
    return r.contrato
  }
  await esperar()
  const banco = ler()
  const { ficha, processo, contrato, assinatura } = paraOPapel(banco, processoId)
  if (!assinatura.arquivo) throw new Error('Anexe a digitalização do contrato assinado')
  const hoje = hojeIso(agora())
  assinatura.assinadoEm = agora().toISOString()
  contrato.etapa = 'leitura'
  processo.etapa = `Contrato assinado em ${dataCurta(hoje, hoje)}`
  processo.proximaAcao = 'ler e arquivar o contrato assinado'
  ficha.historico.push(evento('Concluiu a assinatura em papel, com a digitalização anexada; segue para a leitura'))
  gravar(banco)
  return contrato
}

// GGVP-85 · verificar o contrato assinado. A leitura pela IA é da GGVP-81 (grupo documentos): ela chama
// concluirLeituraDoContrato. Até a junção, "Simular a leitura da IA" usa a leitura de exemplo.

/**
 * POST /api/processos/:id/contrato/leitura, chamado pela leitura da IA (GGVP-81). Reconhecido e tudo certo, nenhuma tarefa é
 * criada e o caso segue para a cópia (CA1, CA7). Sem entender ou com problema, o Atendimento recebe "Conferir contrato" com o
 * que a IA apontou (CA2, CA4).
 */
export async function concluirLeituraDoContrato(processoId: string, leitura: LeituraDoContrato): Promise<Contrato> {
  if (doServidor(processoId)) {
    // GGVP-125, bloco 4c: no servidor, a leitura (ainda a de exemplo) é feita lá; a daqui não vai junto.
    const r = await noBanco<{ contrato: Contrato; ficha: Ficha }>(`/processos/${processoId}/contrato/leitura-simulada`, { method: 'POST' })
    receber(r)
    return r.contrato
  }
  await esperar()
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { ficha, processo, contrato } = achado
  if (contrato.etapa !== 'leitura') throw new Error('Este contrato não está esperando a leitura')
  contrato.leitura = { ...leitura, lidoEm: agora().toISOString() }
  if (precisaConferir(leitura)) {
    contrato.etapa = 'conferir'
    processo.etapa = 'Contrato · conferência'
    processo.proximaAcao = 'conferir o contrato assinado'
    ficha.historico.push(evento(`A IA leu o contrato assinado: ${resumoDaLeitura(leitura)}; o Atendimento confere`, 'IA (leitura)'))
  } else {
    contrato.etapa = 'copia'
    processo.proximaAcao = 'entregar a cópia do contrato'
    ficha.historico.push(evento('A IA leu o contrato assinado e reconheceu: tudo certo; segue para a cópia do contrato', 'IA (leitura)'))
  }
  gravar(banco)
  return contrato
}

/** EXEMPLO. O botão "Simular a leitura da IA" faz o papel da leitura da GGVP-81. */
export async function simularLeituraDoContrato(processoId: string): Promise<Contrato> {
  const caso = await obterContrato(processoId)
  if (!caso) throw new Error('Contrato não encontrado')
  return concluirLeituraDoContrato(processoId, leituraDeExemploDoContrato(caso.contrato))
}

export type Verificacao = { tudoCerto: boolean; oQueCorrigir?: string; paginaCorrigida?: { nome: string; tamanho: number } }

/**
 * POST /api/processos/:id/contrato/verificacao. "Está certo, seguir": vai para a cópia do contrato (CA7). "Não, corrigir e
 * reenviar": o que corrigir é obrigatório e a página corrigida pode ir anexa (CA5); a versão assinada fica no histórico (CA6)
 * e o contrato volta a preparar, para corrigir os campos e reenviar para assinar (CA3).
 */
export async function verificarContrato(processoId: string, v: Verificacao): Promise<Contrato> {
  if (!doServidor(processoId)) await esperar()
  const oQueCorrigir = v.oQueCorrigir?.trim() ?? ''
  if (motivoParadoDaVerificacao(v.tudoCerto, oQueCorrigir)) throw new Error('Escreva o que corrigir')
  if (!v.tudoCerto && v.paginaCorrigida && problemaDoArquivo(v.paginaCorrigida)) throw new Error('Página corrigida inválida')
  if (doServidor(processoId)) {
    const r = await noBanco<{ contrato: Contrato; ficha: Ficha; arquivo?: Arquivo }>(`/processos/${processoId}/contrato/verificacao`, { method: 'POST', corpo: v })
    receber(r)
    if (r.arquivo) anexarAqui(r.ficha.id, r.arquivo)
    return r.contrato
  }
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { ficha, processo, contrato } = achado
  if (contrato.etapa !== 'conferir') throw new Error('Este contrato não está para conferir')
  const quando = agora().toISOString()
  const hoje = hojeIso(agora())
  if (v.tudoCerto) {
    contrato.verificacao = { tudoCerto: true, quem: QUEM, quando }
    contrato.etapa = 'copia'
    processo.etapa = `Contrato assinado em ${dataCurta(hojeIso(new Date(contrato.assinatura?.assinadoEm ?? quando)), hoje)}`
    processo.proximaAcao = 'entregar a cópia do contrato'
    ficha.historico.push(evento('Conferiu o contrato assinado: está certo; segue para a cópia do contrato'))
  } else {
    const versao = contrato.documento?.versao ?? 1
    const pagina = v.paginaCorrigida
    if (pagina) {
      ficha.arquivos.push({ nome: pagina.nome, tipo: 'contrato', local: processo.id, data: hoje, origem: 'card', repetido: false, aguardaLeitura: false })
    }
    contrato.verificacao = { tudoCerto: false, oQueCorrigir, ...(pagina && { paginaCorrigida: pagina.nome }), quem: QUEM, quando }
    contrato.anteriores = [...(contrato.anteriores ?? []), { versao, arquivo: contrato.assinatura?.arquivo, motivo: oQueCorrigir, quando }]
    contrato.assinatura = undefined
    contrato.leitura = undefined
    contrato.etapa = 'preparar'
    processo.etapa = 'Contrato · corrigir e reenviar'
    processo.proximaAcao = 'corrigir os campos e reenviar para assinar'
    ficha.historico.push(
      evento(`Conferiu o contrato assinado: corrigir e reenviar (${oQueCorrigir}). A versão ${versao} assinada fica guardada no histórico`),
    )
  }
  gravar(banco)
  return contrato
}

/** O aviso ao cliente pelo WhatsApp, da tela de conferir: fica em "Últimos contatos". Chatwoot simulado. */
export async function avisarClienteDaConferencia(processoId: string, mensagem: string): Promise<void> {
  if (!doServidor(processoId)) await esperar()
  if (!mensagem.trim()) throw new Error('Escreva a mensagem')
  if (doServidor(processoId)) {
    receber(await noBanco<{ ficha: Ficha }>(`/processos/${processoId}/contrato/conferencia/aviso`, { method: 'POST', corpo: { mensagem } }))
    return
  }
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  achado.ficha.contatos.push({ data: hojeIso(agora()), canal: 'WhatsApp', texto: 'Avisado da pendência no contrato assinado.' })
  achado.ficha.historico.push(evento('Avisou o cliente pelo WhatsApp da pendência no contrato assinado'))
  gravar(banco)
}

// GGVP-89 · cópia do contrato para o cliente levar. A impressora é simulada.

function paraACopia(banco: Banco, processoId: string): ContratoDoCaso {
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  if (achado.contrato.etapa !== 'copia') throw new Error('Este contrato não está para entregar a cópia')
  return achado
}

/** POST /api/processos/:id/contrato/copia/impressao. "Imprimir cópia para o cliente": a versão assinada (CA1). */
export async function imprimirCopia(processoId: string): Promise<Contrato> {
  if (doServidor(processoId)) {
    const r = await noBanco<{ contrato: Contrato; ficha: Ficha }>(`/processos/${processoId}/contrato/copia/impressao`, { method: 'POST' })
    receber(r)
    return r.contrato
  }
  await esperar()
  const banco = ler()
  const { ficha, contrato } = paraACopia(banco, processoId)
  contrato.copia = { ...contrato.copia, impressaEm: agora().toISOString() }
  ficha.historico.push(evento(`Imprimiu a cópia do contrato assinado para o cliente levar: ${contrato.assinatura?.arquivo ?? 'versão assinada'}`))
  gravar(banco)
  return contrato
}

/**
 * POST /api/processos/:id/contrato/copia/visita. A entrega fica para uma visita: o compromisso "Entregar cópia do contrato"
 * entra na agenda com a data da visita (CA4). A visita que já estava marcada fica remarcada.
 */
export async function marcarVisitaDaCopia(processoId: string, data: string, hora: string): Promise<Agendamento> {
  if (!doServidor(processoId)) await esperar()
  const hoje = hojeIso(agora())
  const erros = errosDaVisita(data, hora, hoje)
  if (erros.data || erros.hora) throw new Error('Visita inválida')
  if (doServidor(processoId)) {
    const r = await noBanco<{ visita: Agendamento; contrato: Contrato; ficha: Ficha }>(`/processos/${processoId}/contrato/copia/visita`, {
      method: 'POST',
      corpo: { data, hora },
    })
    receber(r)
    return r.visita
  }
  const banco = ler()
  const { ficha, contrato } = paraACopia(banco, processoId)
  const anterior = visitaDaCopia(ficha, contrato)
  if (anterior) anterior.estado = 'remarcado'
  let n = 1
  while (ficha.agendamentos.some((a) => a.id === `copia-${processoId}-${n}`)) n += 1
  const visita: Agendamento = {
    id: `copia-${processoId}-${n}`,
    data: dataParaIso(normalizarData(data))!,
    hora,
    oQue: 'Entregar cópia do contrato',
    tipo: 'presencial',
    duracao: 30,
  }
  ficha.agendamentos.push(visita)
  contrato.copia = { ...contrato.copia, visitaId: visita.id }
  ficha.historico.push(evento(`Marcou a entrega da cópia do contrato numa visita: ${dataCurta(visita.data, hoje)} às ${hora}`))
  gravar(banco)
  return visita
}

/**
 * POST /api/processos/:id/contrato/copia/entrega. Só com a confirmação de que é a cópia impressa da versão assinada, a data da
 * entrega e quem recebeu; a observação é opcional (CA3). Registrada, o caso segue para o checklist do benefício (D1.21, CA5).
 */
export async function registrarEntregaDaCopia(processoId: string, v: ValoresDaEntrega): Promise<Contrato> {
  if (!doServidor(processoId)) await esperar()
  const hoje = hojeIso(agora())
  if (motivoParadoDaEntrega(v, hoje)) throw new Error('Entrega inválida')
  if (doServidor(processoId)) {
    const r = await noBanco<{ contrato: Contrato; ficha: Ficha }>(`/processos/${processoId}/contrato/copia/entrega`, { method: 'POST', corpo: v })
    receber(r)
    return r.contrato
  }
  const banco = ler()
  const { ficha, processo, contrato } = paraACopia(banco, processoId)
  const entregueEm = dataParaIso(normalizarData(v.entregueEm))!
  const quemRecebeu = normalizarNome(v.quemRecebeu)
  const observacao = v.observacao.trim() || undefined
  contrato.copia = { ...contrato.copia, entrega: { entregueEm, quemRecebeu, ...(observacao && { observacao }), quem: QUEM, quando: agora().toISOString() } }
  const visita = visitaDaCopia(ficha, contrato)
  if (visita) visita.estado = 'realizado'
  contrato.etapa = 'entregue'
  processo.etapa = 'Documentação · checklist do benefício'
  processo.proximaAcao = 'conferir o checklist do benefício (D1.21)'
  processo.prazo = undefined
  processo.urgente = undefined
  ficha.contatos.push({
    data: entregueEm,
    canal: 'Presencial',
    texto: `Recebeu a cópia do contrato assinado${quemRecebeu === ficha.nome ? '' : ` (entregue a ${quemRecebeu})`}.${observacao ? ` ${observacao}` : ''}`,
  })
  ficha.historico.push(
    evento(`Entregou a cópia impressa da versão assinada em ${dataCurta(entregueEm, hoje)} a ${quemRecebeu}; o caso segue para o checklist do benefício (D1.21)`),
  )
  gravar(banco)
  return contrato
}
