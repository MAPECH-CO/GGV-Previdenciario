// EXEMPLO. O caso numa linha só (GGVP-86): o que a página do processo mostra além da ficha e da perícia. A semente
// complementa os processos de exemplo.ts (NB, juízo, linha do processo, esperas, laços dos setores, tarefas, prazos e
// documentos), sem mexer neles. Ligar no servidor: `obterCaso` vira GET /api/casos/:id, com o perfil vindo da sessão.
import { nomeBeneficio, nomeTipo } from './catalogos.ts'
import { ligarPerito, obterPericia, peritosParaLigar, type PericiaNaTela } from './pericia.ts'
import { perfilDoPerito, peritosDo, type PerfilDoPerito } from './peritos.ts'
import { agora, esperar, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo } from './tipos.ts'
import { somarDias } from '../regras/agenda.ts'
import {
  emOrdem,
  estadosDasEtapas,
  ETAPAS_DO_CASO,
  etapaAtual,
  etapaDaOrigem,
  faseDoCaso,
  identificacao,
  jurimetriaDoJuizo,
  prazosDaFase,
  setoresPendentes,
  visaoDoPerfil,
  podeVerValor,
  type TipoDeValor,
  type EstadoDaEtapa,
  type Fase,
  type IdEtapa,
  type TipoDePrazo,
  type VisaoDoCaso,
} from '../regras/caso.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { NOMES_DA_SITUACAO, NOMES_DO_TIPO, ORIGENS, prazoFalado } from '../regras/pericia.ts'

/** Quem fez: uma pessoa, o sistema ou a IA (CA10). */
export type TipoDeAutor = 'pessoa' | 'sistema' | 'ia'

export type EventoDoCaso = {
  /** Data e hora ISO. */
  quando: string
  quem: string
  tipo: TipoDeAutor
  oQue: string
  /** O passo do BPMN (D1.09, D3a.02, DP.04...). */
  passo: string
  etapa: IdEtapa
  /** Os documentos daquele passo, pelo nome na pasta (CA4). */
  documentos?: string[]
  /** Petição, estratégia ou valor: o Atendimento não vê. */
  restrito?: boolean
  /** Ação feita pelo chat (GGVP-82, CA5). */
  peloChat?: boolean
}

export type QuemDeFora = 'cliente' | 'inss' | 'perito' | 'justica'
export const NOMES_DE_FORA: Record<QuemDeFora, string> = { cliente: 'Cliente', inss: 'INSS', perito: 'Perito', justica: 'Justiça' }

/** Esperando alguém de fora do escritório (CA8). */
export type Espera = { quem: QuemDeFora; oQue: string; desde: string; prazo?: string; lembrete?: string }

/** Um laço de setor aberto pela exigência (D3a.03) ou pelo despacho (D3.04): subiu o card ou ainda não (CA3). */
export type Laco = { setor: string; oQue: string; subiu?: { quem: string; quando: string } }

/** Uma tarefa em andamento no caso, de qualquer setor (CA9). */
export type TarefaDoCaso = { setor: string; titulo: string; responsavel: string; prazo: string; paralela?: boolean; href?: string; peloChat?: boolean }

export type PrazoDoCaso = { tipo: TipoDePrazo; quando: string; oQue: string; urgente?: boolean }

export type DocumentoDoCaso = {
  nome: string
  /** Id do catálogo de tipos de documento. */
  tipo: string
  /** De onde veio (CA11): "Scanner", "Card do caso", "Chat", "Meu INSS", "Diário (vigília)"... */
  origem: string
  /** aaaa-mm-dd */
  data: string
  passo?: string
  /** Laudo ou documento médico: o conteúdo é só do Jurídico. */
  saude?: boolean
  /** Petição ou estratégia: o Atendimento não vê. */
  restrito?: boolean
}

/** O que a semente acrescenta a cada processo. */
export type ComplementoDoCaso = {
  processoId: string
  nb?: string
  protocolo?: string
  /** O número CNJ, quando o processo de exemplo.ts não tem número. */
  cnj?: string
  juizoId?: string
  derEm?: string
  /** O caso foi direto à Justiça, sem pedido ao INSS. */
  semInss?: boolean
  /** A linha da etapa atual, como a pessoa lê: "exigência do juiz". */
  passoAtual: string
  linha: EventoDoCaso[]
  esperas: Espera[]
  lacos?: { motivo: string; desde: string; itens: Laco[] }
  tarefas: TarefaDoCaso[]
  prazos: PrazoDoCaso[]
  documentos: DocumentoDoCaso[]
  /** A advogada responsável: a prestação de contas dela é a que ela vê com valores. */
  advogada?: string
  /** O caso está na prestação de contas (D2.06 ou D3b.02). */
  naPrestacaoDeContas?: boolean
  /** Os valores do caso; cada um com a regra de `podeVerValor`. */
  valores?: { tipo: TipoDeValor; rotulo: string; valor: string }[]
  /** Só o Jurídico. */
  estrategia?: string
  /** Só o Jurídico: o resumo de saúde, sem o conteúdo do laudo. */
  saude?: string
}

/** Um juízo e as decisões do acervo, para a jurimetria (ponta da GGVP-64 e da GGVP-131). */
export type Juizo = { id: string; nome: string; juiz: string; decisoes: { beneficio: string; procedente: boolean; meses: number }[]; entendimentos: string[] }

const DRA_PAULA = 'Dra. Paula (exemplo)'
const DRA_RENATA = 'Dra. Renata (exemplo)'
const BRUNA = 'Ana (exemplo)'
const JESSICA = 'Jéssica (exemplo)'
const IGOR = 'Igor (exemplo)'
const MARCOS = 'Marcos (exemplo)'

/** Decisões de exemplo: os primeiros `procedentes` saem procedentes; o tempo varia pela posição. */
function decisoes(beneficio: string, casos: number, procedentes: number, meses: number) {
  return Array.from({ length: casos }, (_, i) => ({ beneficio, procedente: i < procedentes, meses: meses + (i % 3) - 1 }))
}

/** Os juízos do acervo de exemplo. Nomes "(exemplo)": nenhum é real. */
export function juizosDeExemplo(): Juizo[] {
  return [
    {
      id: 'vf-santo-amaro',
      nome: 'Vara Federal de Santo Amaro (exemplo)',
      juiz: 'Dra. H. Costa (exemplo)',
      decisoes: [...decisoes('incapacidade-permanente', 12, 7, 11), ...decisoes('incapacidade-temporaria', 8, 4, 9), ...decisoes('loas-deficiente', 4, 1, 13)],
      entendimentos: [
        'Segue o laudo judicial quando ele fixa a data de início da incapacidade',
        'Pede o CNIS atualizado antes de sentenciar',
        'Nega quando as perícias divergem e não há laudo novo',
      ],
    },
    {
      id: 'jef-sao-paulo',
      nome: 'Juizado Especial Federal de São Paulo (exemplo)',
      juiz: 'Dr. F. Lima (exemplo)',
      decisoes: [...decisoes('pensao-morte', 9, 6, 8), ...decisoes('loas-idoso', 5, 3, 10)],
      entendimentos: ['Aceita a união estável provada por testemunhas e documentos', 'Manda pagar por RPV quando o valor cabe no teto'],
    },
  ]
}

/** Hoje (ou n dias antes), à hora dada, no fuso local, em ISO. */
function em(dias: number, horas = 10, minutos = 0): string {
  const h = agora()
  return new Date(h.getFullYear(), h.getMonth(), h.getDate() + dias, horas, minutos).toISOString()
}

/** A semente: um complemento por processo de exemplo.ts, com datas a partir de hoje. */
export function casosDeExemplo(hoje: string): ComplementoDoCaso[] {
  const dia = (n: number) => somarDias(hoje, n)
  const e = (dias: number, quem: string, tipo: TipoDeAutor, oQue: string, passo: string, etapa: IdEtapa, extra: Partial<EventoDoCaso> = {}): EventoDoCaso => ({
    quando: em(dias),
    quem,
    tipo,
    oQue,
    passo,
    etapa,
    ...extra,
  })
  // Do lead ao contrato liberado: a mesma entrada para os casos que já passaram do D1.
  const entrevista = (base: number, beneficio: string): EventoDoCaso[] => [
    e(base, BRUNA, 'pessoa', 'Lead chegou por indicação; entrevista marcada', 'D1.01', 'entrevista'),
    e(base + 3, DRA_PAULA, 'pessoa', `Entrevista gravada e transcrita; benefício definido: ${beneficio} (a IA sugeriu, a advogada decidiu, G3)`, 'D1.09', 'entrevista', {
      documentos: ['transcricao-entrevista.pdf'],
    }),
    e(base + 5, 'ZapSign', 'sistema', 'Contrato assinado no ZapSign; cópia enviada ao cliente', 'D1.17', 'entrevista', { documentos: ['contrato-zapsign.pdf'] }),
    e(base + 8, JESSICA, 'pessoa', 'Caso liberado ao Jurídico pela Documentação, com parecer médico "Suficiente" (G17)', 'D1.24', 'entrevista', { documentos: ['cnis.pdf'] }),
  ]
  return [
    {
      processoId: 'antonio-exemplo-1',
      juizoId: 'vf-santo-amaro',
      nb: '4561237895',
      derEm: '2025-08-02',
      passoAtual: 'exigência do juiz',
      linha: [
        ...entrevista(-455, 'aposentadoria por incapacidade permanente'),
        e(-445, DRA_RENATA, 'pessoa', 'Sênior conferiu e aprovou o pedido (G2)', 'D2.01', 'inss'),
        e(-433, IGOR, 'pessoa', 'Protocolado no Meu INSS · NB 456.123.789-5', 'D2.02', 'inss', { documentos: ['requerimento-meu-inss.pdf'] }),
        e(-405, 'INSS', 'sistema', 'Perícia do INSS: desfavorável', 'DP.10', 'inss'),
        e(-390, 'Vigília do Meu INSS', 'sistema', 'Indeferido: carência não comprovada', 'D2.07', 'inss', { documentos: ['carta-de-indeferimento.pdf'] }),
        e(-385, 'IA', 'ia', 'Analisou o motivo do indeferimento e sugeriu ajuizar', 'D3.02', 'justica', { restrito: true }),
        e(-384, DRA_RENATA, 'pessoa', 'Despacho da sênior: ajuizar (G4)', 'D3.03', 'justica', { restrito: true }),
        e(-378, DRA_PAULA, 'pessoa', 'Petição inicial protocolada; travas G7 conferidas (Tema 350, pacote, CPF)', 'D3.07', 'justica', {
          documentos: ['peticao-inicial.pdf'],
          restrito: true,
        }),
        e(-11, 'Vigília (IA)', 'ia', 'Publicação lida: exigência do juiz — comprovar o vínculo rural 2018–2020', 'D3a.01', 'vigilia', { documentos: ['publicacao-exigencia.pdf'] }),
        e(-11, DRA_PAULA, 'pessoa', 'Analisou a exigência e criou as tarefas da Documentação e do Atendimento', 'D3a.02', 'vigilia'),
        e(-10, BRUNA, 'pessoa', 'Atendimento confirmou com o cliente o período rural e subiu o card', 'D3a.03', 'vigilia'),
      ],
      esperas: [
        { quem: 'cliente', oQue: 'trazer as notas do produtor rural (2018–2020) e a certidão do sindicato', desde: dia(-11), prazo: dia(2), lembrete: 'cobrança diária pela Documentação' },
        { quem: 'justica', oQue: 'a data da audiência de instrução', desde: dia(-11), lembrete: 'a vigília lê as publicações 3×/dia' },
      ],
      lacos: {
        motivo: 'exigência do juiz: comprovar o vínculo rural 2018–2020',
        desde: dia(-11),
        itens: [
          { setor: 'Atendimento', oQue: 'confirmar com o cliente o período rural', subiu: { quem: BRUNA, quando: em(-10) } },
          { setor: 'Documentação', oQue: 'reunir as notas do produtor e a certidão do sindicato' },
          { setor: 'Perícia', oQue: 'perícia médica pedida pelo juiz (DP)' },
        ],
      },
      tarefas: [
        { setor: 'Documentação', titulo: 'Antônio Exemplo · Cobrar documento', responsavel: JESSICA, prazo: dia(2), paralela: true, href: '/casos/antonio-exemplo-1/cobranca' },
        { setor: 'Jurídico', titulo: 'Antônio Exemplo · Analisar laudo novo', responsavel: DRA_PAULA, prazo: dia(1), href: '/casos/antonio-exemplo-1/laudo-novo' },
      ],
      prazos: [
        { tipo: 'prazo', quando: dia(2), oQue: 'Exigência do juiz — manifestar (G12)', urgente: true },
        { tipo: 'vigilia-publicacoes', quando: 'Diário', oQue: 'Vigília das publicações, 3×/dia (G13)' },
        { tipo: 'vigilia-meu-inss', quando: 'Diário', oQue: 'Vigília do Meu INSS' },
      ],
      documentos: [
        { nome: 'peticao-inicial.pdf', tipo: 'peticao', origem: 'Card do caso', data: dia(-378), passo: 'D3.07', restrito: true },
        { nome: 'laudo-ortopedista.pdf', tipo: 'laudo', origem: 'Chat', data: dia(-9), passo: 'D1.21M', saude: true },
        { nome: 'publicacao-exigencia.pdf', tipo: 'publicacao', origem: 'Diário (vigília)', data: dia(-11), passo: 'D3a.01' },
        { nome: 'cnis.pdf', tipo: 'cnis', origem: 'Meu INSS', data: dia(-447), passo: 'D1.24' },
        { nome: 'procuracao.pdf', tipo: 'procuracao', origem: 'Scanner', data: dia(-12), passo: 'D1.18' },
        { nome: 'contrato-zapsign.pdf', tipo: 'contrato', origem: 'ZapSign', data: dia(-450), passo: 'D1.17' },
      ],
      advogada: DRA_PAULA,
      valores: [{ tipo: 'causa', rotulo: 'Valor da causa', valor: 'R$ 21.480,00 (exemplo)' }],
      estrategia: 'Provar o vínculo rural com as notas e a testemunha; o laudo judicial decide a incapacidade.',
      saude: '3 laudos · parecer Suficiente (G17) · laudo novo a conferir',
    },
    {
      processoId: 'maria-exemplo-1',
      protocolo: '1.802.334.556 (exemplo)',
      derEm: dia(-20),
      passoAtual: 'perícia do INSS',
      linha: [
        ...entrevista(-60, 'auxílio por incapacidade temporária'),
        e(-24, DRA_RENATA, 'pessoa', 'Sênior conferiu e aprovou o pedido (G2)', 'D2.01', 'inss'),
        e(-20, IGOR, 'pessoa', 'Protocolado no Meu INSS · protocolo 1.802.334.556', 'D2.02', 'inss', { documentos: ['requerimento-meu-inss.pdf'] }),
      ],
      esperas: [],
      tarefas: [],
      prazos: [{ tipo: 'vigilia-meu-inss', quando: 'Diário', oQue: 'Vigília do Meu INSS (G13)' }, { tipo: 'vigilia-publicacoes', quando: 'Diário', oQue: 'Vigília das publicações' }],
      documentos: [
        { nome: 'requerimento-meu-inss.pdf', tipo: 'requerimento', origem: 'Meu INSS', data: dia(-20), passo: 'D2.02' },
        { nome: 'laudo-clinico.pdf', tipo: 'laudo', origem: 'Scanner', data: dia(-40), passo: 'D1.18', saude: true },
      ],
      saude: '2 laudos · parecer Suficiente (G17)',
    },
    {
      processoId: 'pedro-exemplo-1',
      nb: '4561237896',
      advogada: DRA_PAULA,
      valores: [{ tipo: 'renda-por-pessoa', rotulo: 'Renda por pessoa (LOAS)', valor: 'R$ 380,00 por pessoa (exemplo)' }],
      derEm: dia(-70),
      passoAtual: 'exigência do INSS',
      linha: [
        ...entrevista(-110, 'BPC/LOAS idoso'),
        e(-74, DRA_RENATA, 'pessoa', 'Sênior conferiu e aprovou o pedido (G2)', 'D2.01', 'inss'),
        e(-70, IGOR, 'pessoa', 'Protocolado no Meu INSS · NB 456.123.789-6', 'D2.02', 'inss', { documentos: ['requerimento-meu-inss.pdf'] }),
        e(-6, 'Vigília do Meu INSS', 'sistema', 'Exigência do INSS aberta: avaliação social e composição do grupo familiar', 'D2.05', 'inss', {
          documentos: ['exigencia-inss.pdf'],
        }),
      ],
      esperas: [{ quem: 'inss', oQue: 'a resposta à exigência', desde: dia(-6), prazo: dia(2), lembrete: 'a vigília confere o Meu INSS todo dia' }],
      lacos: {
        motivo: 'exigência do INSS: avaliação social e grupo familiar',
        desde: dia(-6),
        itens: [
          { setor: 'Documentação', oQue: 'ficha de grupo familiar e CadÚnico atualizado' },
          { setor: 'Perícia', oQue: 'avaliação social marcada (DP)' },
        ],
      },
      tarefas: [{ setor: 'Jurídico', titulo: 'Pedro Exemplo · Responder exigência', responsavel: DRA_PAULA, prazo: dia(2), paralela: true }],
      prazos: [
        { tipo: 'prazo', quando: dia(2), oQue: 'Responder a exigência do INSS (G12)', urgente: true },
        { tipo: 'vigilia-meu-inss', quando: 'Diário', oQue: 'Vigília do Meu INSS (G13)' },
        { tipo: 'vigilia-publicacoes', quando: 'Diário', oQue: 'Vigília das publicações' },
      ],
      documentos: [
        { nome: 'requerimento-meu-inss.pdf', tipo: 'requerimento', origem: 'Meu INSS', data: dia(-70), passo: 'D2.02' },
        { nome: 'exigencia-inss.pdf', tipo: 'exigencia', origem: 'Meu INSS', data: dia(-6), passo: 'D2.05' },
      ],
    },
    {
      processoId: 'lucia-exemplo-1',
      cnj: '0000002-70.2026.4.03.6100',
      juizoId: 'jef-sao-paulo',
      nb: '4561237897',
      passoAtual: 'sentença procedente · prestação de contas',
      linha: [
        ...entrevista(-400, 'pensão por morte'),
        e(-390, DRA_RENATA, 'pessoa', 'Sênior conferiu e aprovou o pedido (G2)', 'D2.01', 'inss'),
        e(-385, IGOR, 'pessoa', 'Protocolado no Meu INSS · NB 456.123.789-7', 'D2.02', 'inss'),
        e(-340, 'Vigília do Meu INSS', 'sistema', 'Indeferido: qualidade de dependente não comprovada', 'D2.07', 'inss', { documentos: ['carta-de-indeferimento.pdf'] }),
        e(-330, DRA_RENATA, 'pessoa', 'Despacho da sênior: ajuizar (G4)', 'D3.03', 'justica', { restrito: true }),
        e(-320, DRA_PAULA, 'pessoa', 'Petição inicial protocolada (G7)', 'D3.07', 'justica', { restrito: true, documentos: ['peticao-inicial.pdf'] }),
        e(-120, 'Vigília (IA)', 'ia', 'Publicação lida: audiência de instrução marcada', 'D3a.01', 'vigilia'),
        e(-2, 'Vigília (IA)', 'ia', 'Publicação lida: sentença procedente', 'D3a.01', 'desfecho', { documentos: ['sentenca.pdf'] }),
      ],
      esperas: [{ quem: 'justica', oQue: 'o pagamento por RPV', desde: dia(-2), lembrete: 'a vigília confere a cada publicação' }],
      tarefas: [
        { setor: 'Jurídico', titulo: 'Lúcia Exemplo · Aprovar aviso ao cliente', responsavel: DRA_PAULA, prazo: hoje },
        { setor: 'Financeiro', titulo: 'Lúcia Exemplo · Prestação de contas', responsavel: MARCOS, prazo: dia(5), paralela: true },
      ],
      prazos: [
        { tipo: 'prazo', quando: dia(13), oQue: 'Recurso do INSS (prazo da outra parte)' },
        { tipo: 'vigilia-publicacoes', quando: 'Diário', oQue: 'Vigília das publicações, 3×/dia (G13)' },
        { tipo: 'vigilia-meu-inss', quando: 'Diário', oQue: 'Vigília do Meu INSS' },
      ],
      documentos: [
        { nome: 'sentenca.pdf', tipo: 'publicacao', origem: 'Diário (vigília)', data: dia(-2), passo: 'D3a.01' },
        { nome: 'peticao-inicial.pdf', tipo: 'peticao', origem: 'Card do caso', data: dia(-320), passo: 'D3.07', restrito: true },
      ],
      advogada: DRA_PAULA,
      naPrestacaoDeContas: true,
      valores: [
        { tipo: 'causa', rotulo: 'Valor da causa', valor: 'R$ 24.300,00 (exemplo)' },
        { tipo: 'prestacao-de-contas', rotulo: 'Prestação de contas', valor: 'RPV de R$ 18.900,00 · honorários pelo contrato (exemplo)' },
      ],
      estrategia: 'Pedir a implantação imediata; recurso do INSS improvável pelo entendimento do juizado.',
    },
    {
      processoId: 'marta-exemplo-1',
      nb: '4561237898',
      passoAtual: 'deferido · ida ao banco',
      linha: [
        ...entrevista(-200, 'BPC/LOAS deficiente'),
        e(-190, DRA_RENATA, 'pessoa', 'Sênior conferiu e aprovou o pedido (G2)', 'D2.01', 'inss'),
        e(-185, IGOR, 'pessoa', 'Protocolado no Meu INSS · NB 456.123.789-8', 'D2.02', 'inss'),
        e(-3, 'Vigília do Meu INSS', 'sistema', 'Benefício deferido', 'D2.06', 'inss', { documentos: ['carta-de-concessao.pdf'] }),
      ],
      esperas: [{ quem: 'cliente', oQue: 'ir ao banco abrir a conta do benefício', desde: dia(-3), lembrete: 'o Atendimento agenda a ida' }],
      tarefas: [{ setor: 'Atendimento', titulo: 'Marta Exemplo · Agendar ida ao banco', responsavel: BRUNA, prazo: dia(3) }],
      prazos: [{ tipo: 'vigilia-meu-inss', quando: 'Diário', oQue: 'Vigília do Meu INSS (G13)' }],
      documentos: [{ nome: 'carta-de-concessao.pdf', tipo: 'carta', origem: 'Meu INSS', data: dia(-3), passo: 'D2.06' }],
    },
    // Os casos ainda na entrevista e nos documentos (D1).
    ...(
      [
        ['nair-exemplo-1', 'aposentadoria por idade', 'contrato · assinatura', 'Atendimento', 'Nair Exemplo · Colher assinatura', BRUNA, 0],
        ['cleide-exemplo-1', 'aposentadoria da pessoa com deficiência', 'contrato · conferência', 'Documentação', 'Cleide Exemplo · Conferir contrato', JESSICA, 0],
        ['cleide-exemplo-2', 'aposentadoria especial', 'cópia do contrato', 'Atendimento', 'Cleide Exemplo · Entregar cópia', BRUNA, 0],
        ['rita-exemplo-1', 'BPC/LOAS deficiente', 'conferência dos documentos', 'Documentação', 'Rita Exemplo · Conferir documentos', JESSICA, 0],
        ['sebastiao-exemplo-1', 'auxílio-acidente', 'liberar ao Jurídico', 'Documentação', 'Sebastião Exemplo · Liberar ao Jurídico', JESSICA, 1],
        ['davi-exemplo-1', 'BPC/LOAS deficiente', 'parecer médico', 'Jurídico', 'Davi Exemplo · Dar parecer médico', DRA_PAULA, 2],
      ] as const
    ).map(([processoId, beneficio, passoAtual, setor, titulo, responsavel, prazo]) => ({
      processoId,
      passoAtual,
      linha: [
        e(-30, BRUNA, 'pessoa', 'Lead chegou; entrevista marcada', 'D1.01', 'entrevista' as const),
        e(-25, DRA_PAULA, 'pessoa', `Entrevista gravada e transcrita; benefício definido: ${beneficio}`, 'D1.09', 'entrevista' as const),
      ],
      esperas: [] as Espera[],
      tarefas: [{ setor, titulo, responsavel, prazo: dia(prazo) }],
      prazos: [] as PrazoDoCaso[],
      documentos: [] as DocumentoDoCaso[],
    })),
  ]
}

function lerComCasos(): Banco {
  const banco = ler()
  if (!banco.casos) {
    banco.casos = casosDeExemplo(hojeIso(agora()))
    gravar(banco)
  }
  return banco
}

/** O complemento do processo, criado vazio quando a semente não tem (para a linha receber o que o chat fizer). */
export function complementoDo(banco: Banco, processoId: string): ComplementoDoCaso {
  banco.casos ??= casosDeExemplo(hojeIso(agora()))
  let c = banco.casos.find((x) => x.processoId === processoId)
  if (!c) {
    c = { processoId, passoAtual: '', linha: [], esperas: [], tarefas: [], prazos: [], documentos: [] }
    banco.casos.push(c)
  }
  return c
}

/** Uma etapa na tela: o estado, o passo atual e, quando pediu a perícia, o bloco "Em perícia" (CA1, CA2). */
export type EtapaNaTela = { id: IdEtapa; rotulo: string; diagrama: string; descricao: string; estado: EstadoDaEtapa; eventos: EventoDoCaso[]; documentos: string[] }

export type EmPericia = {
  etapa: IdEtapa
  rotulo: string
  situacao: string
  href: string
  responsavel: string
  prazo?: string
  data?: string
}

/** A perícia aberta, como tarefa do caso (CA9): quem cuida agora e o prazo. */
function periciaComoTarefa(t: PericiaNaTela, hoje: string): { responsavel: string; prazo?: string; setor: string; titulo: string } {
  const nome = t.ficha.nome
  switch (t.situacao) {
    case 'aguardando-inss':
      return { setor: 'Jurídico administrativo', responsavel: IGOR, titulo: `${nome} · Marcar perícia (espera o INSS liberar)` }
    case 'marcar':
      return { setor: 'Jurídico administrativo', responsavel: IGOR, titulo: `${nome} · Marcar perícia`, prazo: t.proximaTentativa }
    case 'aguardando-comprovante':
      return { setor: 'Jurídico administrativo', responsavel: IGOR, titulo: `${nome} · Subir o comprovante do INSS`, prazo: hoje }
    case 'na-advogada':
      return { setor: 'Jurídico', responsavel: DRA_PAULA, titulo: `${nome} · Decidir a perícia · limite de remarcações`, prazo: hoje }
    case 'aguardando-resultado':
      return { setor: 'Jurídico', responsavel: DRA_PAULA, titulo: `${nome} · Conferir resultado da perícia` }
    case 'concluida':
      return { setor: 'Jurídico', responsavel: DRA_PAULA, titulo: `${nome} · Perícia concluída` }
    default: {
      const docs = t.documentos && !t.pericia.documentos?.concluida && t.documentos.faltando.length > 0
      return docs
        ? { setor: 'Documentação', responsavel: JESSICA, titulo: `${nome} · Reunir documentos da perícia`, prazo: t.prazos?.documentosAte }
        : { setor: 'Jurídico administrativo', responsavel: IGOR, titulo: `${nome} · Orientar para a perícia`, prazo: t.prazos?.preparoAte }
    }
  }
}

/** Esperas que a perícia já diz (CA8): o INSS liberar, o comprovante sair, o resultado no GERID ou no processo. */
function esperasDaPericia(t: PericiaNaTela): Espera[] {
  const desde = hojeIso(new Date(t.pericia.abertaEm))
  if (t.situacao === 'aguardando-inss') return [{ quem: 'inss', oQue: 'liberar o agendamento da perícia', desde, lembrete: 'a vigília confere o Meu INSS todo dia' }]
  if (t.situacao === 'aguardando-comprovante') return [{ quem: 'inss', oQue: 'o comprovante da perícia', desde: hojeIso(new Date(t.pericia.esperaComprovante?.desde ?? t.pericia.abertaEm)), lembrete: 'lembrete diário' }]
  if (t.situacao === 'aguardando-resultado' && t.pericia.marcacao) {
    return [{ quem: t.pericia.instancia === 'inss' ? 'inss' : 'perito', oQue: `o resultado da ${NOMES_DO_TIPO[t.pericia.tipo]}`, desde: t.pericia.marcacao.data, lembrete: t.pericia.instancia === 'inss' ? 'a vigília do GERID' : 'a vigília lê as publicações 3×/dia' }]
  }
  return []
}

export type CasoNaTela = {
  ficha: Pick<Ficha, 'id' | 'nome' | 'cpf' | 'idade' | 'transcricoes' | 'senhaGov'>
  processo: Processo
  beneficio: string
  fase: Fase
  identificacao: { rotulo: string; valor: string }
  /** O que vem logo depois do nome: a etapa como a pessoa lê. */
  passoAtual: string
  etapas: EtapaNaTela[]
  emPericia?: EmPericia
  pendentes: { motivo: string; desde: string; setores: string[]; itens: Laco[] } | null
  esperas: Espera[]
  tarefas: (TarefaDoCaso & { prazoFalado?: { texto: string; urgente: boolean } })[]
  linha: EventoDoCaso[]
  prazos: PrazoDoCaso[]
  documentos: DocumentoDoCaso[]
  laudoNovo?: { data: string; href: string }
  juizo?: { id: string; nome: string; juiz: string }
  perito?: { id: string; nome: string }
  /** Perito lido e não reconhecido, ou ainda não conhecido com a perícia marcada (CA7). */
  peritoParaIdentificar?: { lido?: string; opcoes: { id: string; nome: string; especialidade: string }[] }
  visao: VisaoDoCaso
  /** Só os valores que o perfil pode ver (`podeVerValor`). */
  valores: { tipo: TipoDeValor; rotulo: string; valor: string }[]
  /** Só para o Jurídico. */
  estrategia?: string
  saude?: string
}

const nomePessoa = (quem: string) => (quem === 'Sistema' ? 'Sistema' : quem)

function montar(banco: Banco, processoId: string, quem: QuemPergunta | undefined, pericia: PericiaNaTela | null): CasoNaTela | null {
  let achado: { ficha: Ficha; processo: Processo } | undefined
  for (const ficha of banco.fichas) {
    const processo = ficha.processos.find((p) => p.id === processoId)
    if (processo) achado = { ficha, processo }
  }
  if (!achado) return null
  const { ficha, processo } = achado
  const hoje = hojeIso(agora())
  const perfil = quem?.id
  const visao = visaoDoPerfil(perfil)
  const c = complementoDo(banco, processoId)
  const numero = processo.numero ?? c.cnj
  const fase = faseDoCaso({ etapa: processo.etapa, numero })
  const atual = etapaAtual(processo.etapa)
  const estados = estadosDasEtapas(atual, { deferidoNoInss: /\bdeferido/i.test(processo.etapa) && !/indeferido/i.test(processo.etapa) && fase === 'administrativa', semInss: c.semInss })

  // A linha do caso e a da perícia, juntas e em ordem (CA10). O Atendimento não vê petição, estratégia nem valores.
  const daPericia: EventoDoCaso[] = (pericia ? [...pericia.anteriores, pericia.pericia] : []).flatMap((p) =>
    p.historico.map((h) => ({
      quando: h.quando,
      quem: nomePessoa(h.quem),
      tipo: h.quem === 'Sistema' ? ('sistema' as const) : /\bIA\b/.test(h.quem) ? ('ia' as const) : ('pessoa' as const),
      oQue: h.oQue,
      passo: h.passo,
      etapa: etapaDaOrigem(p.origem),
    })),
  )
  const linha = emOrdem([...c.linha, ...daPericia]).filter((ev) => visao === 'juridico' || !ev.restrito)

  const todos: DocumentoDoCaso[] = [
    ...c.documentos,
    // O que entrou na pasta do processo depois da semente, com a origem do arquivo (CA11).
    ...ficha.arquivos
      .filter((a) => a.local === processoId && !c.documentos.some((d) => d.nome === a.nome))
      .map((a) => ({ nome: a.nome, tipo: a.tipo, origem: a.origem === 'scanner' ? 'Scanner' : a.origem === 'chat' ? 'Chat' : 'Card do caso', data: a.data, saude: a.tipo === 'laudo' })),
  ]
  const documentos = todos.filter((d) => visao === 'juridico' || !d.restrito).sort((a, b) => (a.data < b.data ? 1 : -1))

  const etapas: EtapaNaTela[] = ETAPAS_DO_CASO.map((et) => {
    const eventos = linha.filter((ev) => ev.etapa === et.id)
    return { ...et, estado: estados[et.id], eventos, documentos: [...new Set(eventos.flatMap((ev) => ev.documentos ?? []))].filter((n) => documentos.some((d) => d.nome === n) || visao === 'juridico') }
  })

  let emPericia: EmPericia | undefined
  const tarefas: CasoNaTela['tarefas'] = [...c.tarefas]
  const esperas = [...c.esperas]
  let perito: CasoNaTela['perito']
  let peritoParaIdentificar: CasoNaTela['peritoParaIdentificar']
  if (pericia && pericia.situacao !== 'concluida') {
    const p = pericia.pericia
    const comoTarefa = periciaComoTarefa(pericia, hoje)
    emPericia = {
      etapa: etapaDaOrigem(p.origem),
      rotulo: `Em perícia · ${ORIGENS[p.origem].caso} · ${NOMES_DO_TIPO[p.tipo]}`,
      situacao: NOMES_DA_SITUACAO[pericia.situacao],
      href: `/casos/${processoId}/pericia`,
      responsavel: comoTarefa.responsavel,
      prazo: comoTarefa.prazo,
      data: p.marcacao ? `${dataCurta(p.marcacao.data, hoje)}, ${p.marcacao.hora} · ${p.marcacao.local}` : undefined,
    }
    tarefas.push({ setor: comoTarefa.setor, titulo: comoTarefa.titulo, responsavel: comoTarefa.responsavel, prazo: comoTarefa.prazo ?? '', paralela: true, href: emPericia.href })
    esperas.push(...esperasDaPericia(pericia))
    if (p.peritoId && pericia.perfil) perito = { id: p.peritoId, nome: pericia.perfil.perito.nome }
    else if (p.peritoLido || p.marcacao) peritoParaIdentificar = { lido: p.peritoLido, opcoes: peritosParaLigar(p.tipo) }
  }
  // As tarefas criadas pelo chat neste caso (GGVP-82, CA5).
  for (const t of banco.tarefasDoChat ?? []) {
    if (t.processoId === processoId && !t.concluida) tarefas.push({ setor: t.setor, titulo: t.titulo, responsavel: t.responsavel, prazo: t.prazo ?? '', peloChat: true })
  }
  const laco = c.lacos
  const juizo = c.juizoId ? (banco.juizos ?? juizosDeExemplo()).find((j) => j.id === c.juizoId) : undefined

  return {
    ficha: { id: ficha.id, nome: ficha.nome, cpf: ficha.cpf, idade: ficha.idade, transcricoes: ficha.transcricoes, senhaGov: ficha.senhaGov },
    processo,
    beneficio: nomeBeneficio(processo.beneficio),
    fase,
    identificacao: identificacao(fase, { numero, nb: c.nb, protocolo: c.protocolo }),
    passoAtual: c.passoAtual || processo.etapa,
    etapas,
    emPericia,
    pendentes: laco ? { motivo: laco.motivo, desde: laco.desde, setores: setoresPendentes(laco.itens), itens: laco.itens } : null,
    esperas,
    tarefas: tarefas.map((t) => ({ ...t, prazoFalado: /^\d{4}-\d{2}-\d{2}$/.test(t.prazo) ? prazoFalado(t.prazo, hoje) : undefined })),
    linha,
    prazos: prazosDaFase(fase, c.prazos),
    documentos,
    // O laudo novo ainda não conferido (CA5): no cabeçalho e na ficha, levando à análise do laudo.
    laudoNovo: (processo.laudoNovoEm ?? ficha.laudoNovoEm) ? { data: (processo.laudoNovoEm ?? ficha.laudoNovoEm)!, href: `/casos/${processoId}/laudo-novo` } : undefined,
    juizo: juizo && { id: juizo.id, nome: juizo.nome, juiz: juizo.juiz },
    perito,
    peritoParaIdentificar,
    visao,
    valores: (c.valores ?? []).filter((v) =>
      podeVerValor(perfil, v.tipo, { advogadaDoCaso: !!quem && quem.usuario === c.advogada, naPrestacaoDeContas: !!c.naPrestacaoDeContas }),
    ),
    estrategia: visao === 'juridico' ? c.estrategia : undefined,
    saude: visao === 'juridico' ? c.saude : undefined,
  }
}

/** Quem pergunta: o perfil e a pessoa (no main, vêm do login). */
export type QuemPergunta = { id: string; usuario: string }

/** GET /api/casos/:id: o caso na visão do perfil de quem pergunta. */
export async function obterCaso(processoId: string, quem: QuemPergunta | undefined): Promise<CasoNaTela | null> {
  // A perícia semeia o banco dela; o caso lê depois, para as duas sementes ficarem juntas.
  const pericia = await obterPericia(processoId)
  const banco = lerComCasos()
  return montar(banco, processoId, quem, pericia)
}

/** O perito ligado em um clique (CA7): usa o mesmo caminho da perícia e devolve o caso de novo. Nada trava enquanto isso. */
export async function identificarPerito(processoId: string, peritoId: string, quem: QuemPergunta): Promise<CasoNaTela | null> {
  await ligarPerito(processoId, peritoId, quem.usuario)
  return obterCaso(processoId, quem)
}

/** O perfil do perito do caso, para a sobreposição da jurimetria (CA6). Ponta da GGVP-59. */
export function perfilDoPeritoDoCaso(peritoId: string): PerfilDoPerito | null {
  const perito = peritosDo(ler()).find((p) => p.id === peritoId)
  if (perito) return perfilDoPerito(perito)
  return null
}

/** A jurimetria do juízo, calculada pelo sistema sobre o acervo de exemplo (CA6). Ponta da GGVP-64 e da GGVP-131. */
export function jurimetriaDoJuizoDoCaso(juizoId: string) {
  const banco = ler()
  const juizo = (banco.juizos ?? juizosDeExemplo()).find((j) => j.id === juizoId)
  if (!juizo) return null
  const numeros = jurimetriaDoJuizo(juizo.decisoes, hojeIso(agora()))
  const processos = (banco.casos ?? [])
    .filter((c) => c.juizoId === juizoId)
    .flatMap((c) => {
      const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === c.processoId))
      return ficha ? [{ processoId: c.processoId, cliente: ficha.nome, sub: c.passoAtual }] : []
    })
  return { juizo, numeros: { ...numeros, porBeneficio: numeros.porBeneficio.map((b) => ({ ...b, nome: nomeBeneficio(b.beneficio) })) }, processos }
}

/** Os documentos do caso que o catálogo de tipos ainda não tem (peças e cartas do processo). */
const OUTROS_TIPOS: Record<string, string> = {
  peticao: 'Petição inicial',
  publicacao: 'Publicação no diário',
  requerimento: 'Requerimento no Meu INSS',
  exigencia: 'Exigência do INSS',
  carta: 'Carta do INSS',
}

export const nomeDoDocumento = (d: { tipo: string; nome: string }) => nomeTipo(d.tipo) || OUTROS_TIPOS[d.tipo] || d.nome

/** "Abrir" um documento a partir do caso (CA11): a origem, a data e o passo; o conteúdo do laudo só para o Jurídico. */
export function descreverDocumento(d: DocumentoDoCaso, visao: VisaoDoCaso, hoje: string): { titulo: string; linhas: string[]; aviso?: string } {
  return {
    titulo: nomeDoDocumento(d),
    linhas: [`Arquivo: ${d.nome}`, `Origem: ${d.origem}`, `Data: ${dataCurta(d.data, hoje)}`, ...(d.passo ? [`Passo: ${d.passo}`] : [])],
    aviso: d.saude && visao !== 'juridico' ? 'O conteúdo do laudo é só do Jurídico: aqui aparece só que ele existe.' : undefined,
  }
}

/** Para o teste: grava o banco depois de mexer no complemento. */
export async function gravarCaso(mudar: (c: ComplementoDoCaso) => void, processoId: string) {
  await esperar()
  const banco = lerComCasos()
  mudar(complementoDo(banco, processoId))
  gravar(banco)
}
