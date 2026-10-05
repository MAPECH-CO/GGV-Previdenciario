// EXEMPLO. Servidor de exemplo do contrato do caso (GGVP-65 em diante), sobre o mesmo banco de servidor.ts. Um contrato por
// processo: o kit, o preenchimento, a assinatura, a conferência e a cópia. Ligar no servidor: trocar o corpo de cada função
// por fetch no endpoint indicado na spec da história, sobre o mesmo contrato. ZapSign, Drive, Chatwoot e IA são simulados.
import { somarDias } from '../regras/agenda.ts'
import { problemaDoArquivo } from '../regras/arquivos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { fichaComCpf } from '../regras/duplicidade.ts'
import {
  CONFERENCIAS,
  NOMES_DOS_CANAIS,
  SEM_CONDICOES,
  TENTATIVAS_DE_ASSINATURA,
  camposDoModelo,
  cobrancaDaAssinatura,
  datasDoKit,
  entrevistaDoCaso,
  papelNaHora,
  precisaConferir,
  resumoDaLeitura,
  motivoParadoDaVerificacao,
  mensagemDoLink,
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
  type CanalDaTentativa,
  type CondicoesDoKit,
  type FormaDeAssinar,
  type DadosDoContrato,
  type DocumentoDoKit,
  type IdDaConferencia,
  type KitMontado,
  type LeituraDoContrato,
} from '../regras/contrato.ts'
import { BENEFICIOS, nomeBeneficio } from './catalogos.ts'
import { QUEM, agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Arquivo, Ficha, Processo, Tarefa, TarefaEncaminhada } from './tipos.ts'

// Espelho do contrato (Zod) da spec de cada história; vai para packages/contratos/contrato.ts.

/**
 * Onde o contrato do caso está: preparar (D1.16), colher a assinatura (D1.17), a leitura do assinado pela Documentação (D1.18,
 * GGVP-81) e, nas histórias seguintes, conferir e a cópia.
 */
export type EtapaDoContrato = 'preparar' | 'assinatura' | 'leitura' | 'conferir' | 'copia'

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
  /** Como o cliente assina e o que já aconteceu (GGVP-72). */
  assinatura?: Assinatura
  /** O que a IA leu do contrato assinado (GGVP-81 lê; GGVP-85 confere). */
  leitura?: LeituraDoContrato & { lidoEm: string }
  /** A conferência do Atendimento: "Está tudo certo?" (GGVP-85, CA5). */
  verificacao?: { tudoCerto: boolean; oQueCorrigir?: string; paginaCorrigida?: string; quem: string; quando: string }
  /** As versões assinadas que voltaram para corrigir: ficam no histórico (GGVP-85, CA6). */
  anteriores?: { versao: number; arquivo?: string; motivo: string; quando: string }[]
}

/** Uma tentativa de contato para o cliente assinar: o link enviado e os lembretes (GGVP-72, CA5). */
export type TentativaDeAssinatura = {
  /** aaaa-mm-dd */
  data: string
  /** Data e hora ISO. */
  quando: string
  canal: CanalDaTentativa
  quem: string
}

export type Assinatura = {
  forma: FormaDeAssinar
  /** Um documento no ZapSign por kit; o identificador fica no caso (GGVP-72, CA4). */
  zapsign?: {
    documentoId: string
    link: string
    /** O status que a integração informa. */
    status: 'enviado' | 'assinado'
    criadoEm: string
    /** Os eventos do retorno já recebidos: o mesmo evento repetido não anexa duas vezes (CA7). */
    eventos: string[]
  }
  tentativas: TentativaDeAssinatura[]
  /** Limite de tentativas atingido: o caso subiu para a advogada sênior (G15, CA11). */
  naSenior?: boolean
  /** A última falha ao gerar no ZapSign, com a opção de tentar de novo (CA9). */
  erro?: string
  /** Data e hora ISO em que o documento assinado voltou. */
  assinadoEm?: string
  /** O arquivo assinado, anexado no card: o do ZapSign ou a digitalização do papel. */
  arquivo?: string
  /** Papel na hora: quando o kit foi impresso (GGVP-77, CA1). */
  impressoEm?: string
}

export type ContratoDoCaso = { ficha: Ficha; processo: Processo; contrato: Contrato }

/** EXEMPLO. O ZapSign simulado: o link é obviamente falso e não abre nada. */
const linkDoZapSign = (documentoId: string) => `https://zapsign.exemplo/assinar/${documentoId}`

/**
 * Os contratos da semente, só com processos que já existem em exemplo.ts: a Cleide fechou a Aposentadoria PCD e o contrato
 * está para preparar (Figma step_D1.16 `10:143`); a Nair recebeu o link do ZapSign há 9 dias e ainda não assinou.
 */
export function contratosDeExemplo(fichas: Ficha[], hoje: string): Contrato[] {
  const novo = (processoId: string, etapa: EtapaDoContrato, resto: Partial<Contrato> = {}): Contrato | null => {
    const ficha = fichas.find((f) => f.processos.some((p) => p.id === processoId))
    const processo = ficha?.processos.find((p) => p.id === processoId)
    if (!ficha || !processo) return null
    return { processoId, fichaId: ficha.id, etapa, condicoes: SEM_CONDICOES, kit: montarKit(processo.beneficio), abertoEm: `${hoje}T09:00:00.000Z`, ...resto }
  }
  const enviadoEm = somarDias(hoje, -9)
  return [
    novo('cleide-exemplo-1', 'preparar'),
    novo('nair-exemplo-1', 'assinatura', {
      assinatura: {
        forma: 'digital',
        zapsign: {
          documentoId: 'zapsign-exemplo-nair-exemplo-1',
          link: linkDoZapSign('zapsign-exemplo-nair-exemplo-1'),
          status: 'enviado',
          criadoEm: `${enviadoEm}T13:00:00.000Z`,
          eventos: [],
        },
        tentativas: [{ data: enviadoEm, quando: `${enviadoEm}T13:00:00.000Z`, canal: 'whatsapp', quem: 'Atendimento' }],
      },
    }),
  ].filter((c): c is Contrato => c !== null)
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

/** A tarefa do Atendimento em cada etapa. Na leitura do contrato assinado, quem trabalha é a Documentação (GGVP-81). */
const TITULOS: Partial<Record<EtapaDoContrato, { codigo: string; acao: string; rota: string }>> = {
  preparar: { codigo: 'D1.16', acao: 'Preparar contrato', rota: 'preparar' },
  assinatura: { codigo: 'D1.17', acao: 'Colher assinatura', rota: 'assinatura' },
  conferir: { codigo: 'D1.19', acao: 'Conferir contrato', rota: 'conferir' },
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
    const modelo = c.kit ? modeloPorId(c.kit.modelo).nome : ''
    const base = { detalhe: [c.kit ? `kit ${c.kit.nome} · ${modelo}` : 'benefício sem kit cadastrado'], prazo: processo.prazo ?? 'hoje', urgente: processo.urgente }
    const andamento =
      c.etapa === 'assinatura'
        ? andamentoDaAssinatura(c.assinatura, hoje)
        : c.etapa === 'conferir' && c.leitura
          ? { detalhe: [resumoDaLeitura(c.leitura)], prazo: 'hoje', urgente: false }
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
    ficha.historico.push(evento(`Gerou o documento no ZapSign pelo modelo ${identificadorDoModelo(modeloPorId(contrato.kit.modelo))}: ${documentoId}`))
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
  await esperar()
  if (!(canal in NOMES_DOS_CANAIS)) throw new Error('Canal inválido')
  if (canal === 'whatsapp' && !mensagem?.trim()) throw new Error('Escreva a mensagem')
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
export async function simularRetornoDoZapSign(processoId: string) {
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
 * contrato de honorários (CA1). Só na entrevista presencial (CA4).
 */
export async function imprimirKit(processoId: string): Promise<{ contrato: Contrato; datas: { documento: string; data: string }[] }> {
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

/**
 * EXEMPLO. A leitura da IA simulada: o papel da primeira versão vem com a página da assinatura cortada (Figma 10:202); o resto
 * a IA reconhece. A leitura de verdade é da GGVP-81.
 */
export function leituraDeExemploDoContrato(contrato: Contrato): LeituraDoContrato {
  const assinatura = { reconhecida: true, texto: 'reconhecida (nome e CPF conferem)' }
  if (contrato.assinatura?.forma === 'papel' && (contrato.documento?.versao ?? 1) === 1) {
    return { reconhecido: true, assinatura, faltam: ['pág. 4 (rubrica)'], pendencias: ['a página da assinatura veio cortada'] }
  }
  return { reconhecido: true, assinatura, faltam: [], pendencias: [] }
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
  await esperar()
  const oQueCorrigir = v.oQueCorrigir?.trim() ?? ''
  if (motivoParadoDaVerificacao(v.tudoCerto, oQueCorrigir)) throw new Error('Escreva o que corrigir')
  if (!v.tudoCerto && v.paginaCorrigida && problemaDoArquivo(v.paginaCorrigida)) throw new Error('Página corrigida inválida')
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
  await esperar()
  if (!mensagem.trim()) throw new Error('Escreva a mensagem')
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  achado.ficha.contatos.push({ data: hojeIso(agora()), canal: 'WhatsApp', texto: 'Avisado da pendência no contrato assinado.' })
  achado.ficha.historico.push(evento('Avisou o cliente pelo WhatsApp da pendência no contrato assinado'))
  gravar(banco)
}
