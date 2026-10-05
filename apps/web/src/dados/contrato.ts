// EXEMPLO. Servidor de exemplo do contrato do caso (GGVP-65 em diante), sobre o mesmo banco de servidor.ts. Um contrato por
// processo: o kit, o preenchimento, a assinatura, a conferência e a cópia. Ligar no servidor: trocar o corpo de cada função
// por fetch no endpoint indicado na spec da história, sobre o mesmo contrato. ZapSign, Drive, Chatwoot e IA são simulados.
import { hojeIso } from '../regras/datas.ts'
import { fichaComCpf } from '../regras/duplicidade.ts'
import {
  CONFERENCIAS,
  SEM_CONDICOES,
  camposDoModelo,
  erroDoCampo,
  faltando,
  honorariosDoModelo,
  identificadorDoModelo,
  linhaDoBeneficio,
  montarKit,
  modeloPorId,
  normalizarCampo,
  preencherModelo,
  restosDoModelo,
  ROTULOS_DOS_CAMPOS,
  type CampoDoModelo,
  type CampoPreenchido,
  type CondicoesDoKit,
  type DadosDoContrato,
  type DocumentoDoKit,
  type IdDaConferencia,
  type KitMontado,
} from '../regras/contrato.ts'
import { BENEFICIOS, nomeBeneficio } from './catalogos.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

// Espelho do contrato (Zod) da spec de cada história; vai para packages/contratos/contrato.ts.

/** Onde o contrato do caso está: preparar (D1.16), colher a assinatura (D1.17) e, nas histórias seguintes, conferir e a cópia. */
export type EtapaDoContrato = 'preparar' | 'assinatura'

/** O documento gerado pelo modelo: os campos e o texto de cada documento do kit (GGVP-69). */
export type DocumentoGerado = {
  versao: number
  /** Data e hora ISO. */
  geradoEm: string
  campos: CampoPreenchido[]
  textos: { documento: string; texto: string }[]
}

export type Contrato = {
  processoId: string
  fichaId: string
  etapa: EtapaDoContrato
  /** O que o caso diz e muda o kit do LOAS (GGVP-65, CA2 e CA8). */
  condicoes: CondicoesDoKit
  /** Guardado no caso; nulo quando o benefício não tem kit na tabela. */
  kit: KitMontado | null
  /** Data e hora ISO em que o caso fechou. */
  abertoEm: string
  /** O RG, a parte contrária escrita e o representante: a ficha não tem (GGVP-69). */
  dados?: DadosDoContrato
  /** Os campos corrigidos na conferência (GGVP-69, CA5). */
  corrigidos?: CampoDoModelo[]
  documento?: DocumentoGerado
  /** Toda versão gerada fica, com o motivo (GGVP-69, CA3). */
  versoes?: { versao: number; geradoEm: string; motivo: string }[]
}

export type ContratoDoCaso = { ficha: Ficha; processo: Processo; contrato: Contrato }

/**
 * Os contratos da semente, só com processos que já existem em exemplo.ts: a Cleide fechou a Aposentadoria PCD e o contrato
 * está para preparar (Figma step_D1.16 `10:143`).
 */
export function contratosDeExemplo(fichas: Ficha[], hoje: string): Contrato[] {
  const novo = (processoId: string, etapa: EtapaDoContrato): Contrato | null => {
    const ficha = fichas.find((f) => f.processos.some((p) => p.id === processoId))
    const processo = ficha?.processos.find((p) => p.id === processoId)
    if (!ficha || !processo) return null
    return { processoId, fichaId: ficha.id, etapa, condicoes: SEM_CONDICOES, kit: montarKit(processo.beneficio), abertoEm: `${hoje}T09:00:00.000Z` }
  }
  return [novo('cleide-exemplo-1', 'preparar')].filter((c): c is Contrato => c !== null)
}

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

const TITULOS: Record<EtapaDoContrato, { codigo: string; acao: string; rota: string }> = {
  preparar: { codigo: 'D1.16', acao: 'Preparar contrato', rota: 'preparar' },
  assinatura: { codigo: 'D1.17', acao: 'Colher assinatura', rota: 'assinatura' },
}

/** A tarefa do Atendimento em cada etapa do contrato (título da lista fixa: "nome · Preparar contrato"). */
export function tarefasDoContrato(): Tarefa[] {
  const banco = ler()
  return contratos(banco).flatMap((c): Tarefa[] => {
    const achado = achar(banco, c.processoId)
    const titulo = TITULOS[c.etapa]
    if (!achado || !titulo) return []
    const { ficha, processo } = achado
    const modelo = c.kit ? modeloPorId(c.kit.modelo).nome : ''
    return [
      {
        id: `contrato-${c.processoId}`,
        codigo: titulo.codigo,
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: titulo.acao,
        detalhe: [nomeBeneficio(processo.beneficio), c.kit ? `kit ${c.kit.nome} · ${modelo}` : 'benefício sem kit cadastrado'].join(' · '),
        prazo: processo.prazo ?? 'hoje',
        urgente: processo.urgente,
        href: `/contrato/${c.processoId}/${titulo.rota}`,
        processoId: c.processoId,
      },
    ]
  })
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
  await esperar()
  if (beneficio === 'nao-sei' || !BENEFICIOS.some((b) => b.id === beneficio)) throw new Error('Benefício fora do catálogo')
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
  const kit = montarKit(beneficio)
  const contrato: Contrato = { processoId: processo.id, fichaId, etapa: 'preparar', condicoes: SEM_CONDICOES, kit, abertoEm: agora().toISOString() }
  contratos(banco).push(contrato)
  ficha.historico.push(
    evento(
      kit
        ? `Fechou ${nomeBeneficio(beneficio)}: processo novo com o kit ${kit.nome} (${kit.documentos.length} documentos, ${modeloPorId(kit.modelo).nome})`
        : `Fechou ${nomeBeneficio(beneficio)}: processo novo, sem kit cadastrado para o benefício`,
    ),
  )
  gravar(banco)
  return { ficha, processo, contrato }
}

const ROTULOS_DAS_CONDICOES: Record<keyof CondicoesDoKit, string> = {
  representado: 'representado por genitor(a)',
  moradia: 'comprovante de residência em nome de outra pessoa',
  uniaoEstavel: 'união estável',
  separacaoDeFato: 'separação de fato',
}

/** PUT /api/processos/:id/contrato/condicoes. As condições do LOAS montam o kit de novo (CA2, CA8). */
export async function salvarCondicoes(processoId: string, condicoes: CondicoesDoKit): Promise<Contrato> {
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

/** Os campos do modelo para o caso, com o valor e de onde veio (CA1, CA5). */
export function camposDoCaso({ ficha, processo, contrato }: ContratoDoCaso): CampoPreenchido[] {
  return camposDoModelo({
    ficha,
    beneficio: processo.beneficio,
    nomeDoBeneficio: nomeBeneficio(processo.beneficio),
    condicoes: contrato.condicoes,
    dados: contrato.dados ?? {},
    corrigidos: contrato.corrigidos ?? [],
  })
}

/**
 * EXEMPLO. Os modelos convertidos, simulados: um texto curto por documento, com os campos {{...}}. Os de verdade estão na
 * pasta "MODELOS ZAPSIGN · PREV" e no ZapSign (CA10); entram ao ligar no servidor.
 */
const TEXTOS_DOS_MODELOS: Record<DocumentoDoKit, string> = {
  contrato:
    'CONTRATO DE HONORÁRIOS. {{nome}}, {{estadoCivil}}, {{profissao}}, CPF {{cpf}}, RG {{rg}}, residente em {{endereco}}, telefone ' +
    '{{telefone}}, contrata o escritório para o pedido de {{beneficio}}. Honorários: {{honorarios}}.',
  procuracao: 'PROCURAÇÃO. {{nome}}, CPF {{cpf}}, RG {{rg}}, nomeia os advogados do escritório para o pedido de {{beneficio}}.',
  hipossuficiencia: 'DECLARAÇÃO DE HIPOSSUFICIÊNCIA. {{nome}}, CPF {{cpf}}, declara que não pode pagar as custas sem prejuízo do sustento.',
  residencia: 'DECLARAÇÃO DE RESIDÊNCIA. {{nome}}, CPF {{cpf}}, declara residir em {{endereco}}.',
  'termo-inss': 'TERMO DE REPRESENTAÇÃO NO INSS. {{nome}}, CPF {{cpf}}, autoriza o escritório no pedido de {{beneficio}}.',
  'codigo-penal': 'CÓDIGO PENAL. {{nome}}, CPF {{cpf}}, declara saber que declaração falsa é crime. Esta página vai sem assinatura.',
  'grupo-familiar': 'FICHA DE GRUPO FAMILIAR. {{nome}}, CPF {{cpf}}, residente em {{endereco}}.',
  'declaracao-moradia': 'DECLARAÇÃO DE MORADIA. {{nome}}, CPF {{cpf}}, declara morar em {{endereco}}.',
  'declaracao-uniao-estavel': 'DECLARAÇÃO DE UNIÃO ESTÁVEL. {{nome}}, CPF {{cpf}}, declara viver em união estável.',
  'declaracao-separacao': 'DECLARAÇÃO DE SEPARAÇÃO DE FATO. {{nome}}, CPF {{cpf}}, declara estar separado(a) de fato.',
}

/** EXEMPLO. O cliente de exemplo que os Contratos Completos traziam antes de convertidos: não pode sobrar no texto (CA8). */
export const CLIENTE_DO_EXEMPLO_DOS_MODELOS = ['Fulana Exemplo do Modelo']

function textosDoKit(kit: KitMontado, campos: CampoPreenchido[]): { documento: string; texto: string }[] {
  const valores: Record<string, string> = Object.fromEntries(campos.map((c) => [c.campo, c.valor]))
  valores.honorarios = honorariosDoModelo(modeloPorId(kit.modelo))
  const temParte = campos.some((c) => c.campo === 'parteContraria')
  const representado = campos.some((c) => c.campo === 'representanteNome')
  return kit.documentos.map((d) => {
    let modelo = TEXTOS_DOS_MODELOS[d.id]
    if (d.id === 'contrato' || d.id === 'procuracao') {
      if (temParte) modelo += ' Parte contrária: {{parteContraria}}.'
      if (representado) modelo += ' Representado por {{representanteParentesco}} {{representanteNome}}, CPF {{representanteCpf}}, RG {{representanteRg}}.'
    }
    return { documento: d.nome, texto: preencherModelo(modelo, valores) }
  })
}

export type EnvioDoContrato = {
  /** "Os documentos foram aprovados?" */
  aprovados: boolean
  /** Obrigatório com "Não, corrigir campos" (CA6). */
  oQueCorrigir?: string
  conferencias: Record<IdDaConferencia, boolean>
  /** Os campos corrigidos na tela, só com "Não, corrigir campos" (CA3). */
  correcoes: Partial<Record<CampoDoModelo, string>>
}

export type RespostaGerar =
  | { resultado: 'gerado'; contrato: Contrato }
  | { resultado: 'faltam'; campos: CampoDoModelo[] }
  | { resultado: 'cpf-de-outra-ficha'; nome: string }
  | { resultado: 'sobrou-do-exemplo'; restos: string[] }

const DA_FICHA = ['nome', 'estadoCivil', 'profissao', 'cpf', 'endereco', 'telefone'] as const
type CampoDaFicha = (typeof DA_FICHA)[number]
const daFicha = (c: CampoDoModelo): c is CampoDaFicha => (DA_FICHA as readonly string[]).includes(c)

const juntar = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`)

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
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { ficha, processo, contrato } = achado
  if (contrato.etapa !== 'preparar' || !contrato.kit) throw new Error('Este contrato não está para preparar')

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
  const modelo = modeloPorId(contrato.kit.modelo)
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
