// Contratos da Recepção ligada no servidor (GGVP-125, bloco 1: o lead e a ficha). Espelham os tipos das telas do Pedro
// (apps/web/src/dados/tipos.ts); a forma é conferida aqui, e as regras (nome, CPF, telefone, idade, duplicidade) são as
// mesmas do servidor de exemplo, rodando no servidor de verdade.
import { z } from 'zod'

const Texto = (max: number) => z.string().trim().max(max)
const Opcional = (max: number) => Texto(max).optional()

/** POST /api/balcao/busca: o termo vai no corpo, nunca no endereço (CPF e telefone não vão ao registro do servidor). */
export const BuscaNoBalcao = z.object({ termo: Texto(120) })
export type BuscaNoBalcao = z.infer<typeof BuscaNoBalcao>

/** POST /api/fichas/duplicidade: o bloco "Já existe?" do Novo cliente. */
export const ConsultaDeDuplicidade = z.object({ nome: Texto(200), telefone: Texto(30), cpf: Opcional(20) })
export type ConsultaDeDuplicidade = z.infer<typeof ConsultaDeDuplicidade>

/** POST /api/fichas: o que a tela "Novo cliente" manda (GGVP-16). */
export const NovoClienteDoBalcao = z.object({
  nome: Texto(200),
  idade: z.number().int(),
  pretende: Texto(2000),
  telefone: Texto(30),
  cpf: Opcional(20),
  email: Opcional(200),
  cidadeUf: Opcional(200),
  beneficioInteresse: Texto(100),
  comoChegou: Opcional(100),
  indicadoPor: Opcional(200),
  observacao: Opcional(2000),
  outraPessoa: z.boolean(),
})
export type NovoClienteDoBalcao = z.infer<typeof NovoClienteDoBalcao>

/** PATCH /api/fichas/:id: os campos que a ficha deixa editar. */
export const EdicaoDaFicha = z.object({
  nome: Texto(200),
  cpf: Opcional(20),
  nascimento: Opcional(10),
  telefone: Texto(30),
  email: Opcional(200),
  estadoCivil: Opcional(50),
  endereco: Opcional(300),
  cidadeUf: Opcional(200),
  cep: Opcional(20),
  profissao: Opcional(200),
  comoChegou: Opcional(100),
  contatoPreferido: Opcional(200),
  contatoApoio: Opcional(300),
  observacoes: Opcional(2000),
})
export type EdicaoDaFicha = z.infer<typeof EdicaoDaFicha>

/**
 * PUT /api/fichas/:id/ficha-de-atendimento (GGVP-24): a triagem e os dados pessoais. Sem campo de senha (CA8, G9):
 * o objeto é estrito por campo, e qualquer outro campo, como uma senha, cai fora antes de chegar à regra.
 */
export const EnvioDaFichaDeAtendimento = z.object({
  nome: Texto(200),
  cpf: Texto(20),
  nascimento: Texto(10),
  telefone: Texto(30),
  endereco: Opcional(300),
  pessoasNaCasa: z.number().int().min(0).max(50).optional(),
  beneficioInteresse: Texto(100),
  ultimaAtividade: Opcional(300),
  semTrabalharDesde: Opcional(20),
  pedidosAoInss: Opcional(1000),
  origem: z.enum(['papel', 'tablet']),
  modelo: z.enum(['GGV', 'APA']).optional(),
})
export type EnvioDaFichaDeAtendimento = z.infer<typeof EnvioDaFichaDeAtendimento>

// Bloco 2 (GGVP-125): a agenda, a confirmação e o encaminhamento do balcão. As regras (horários, durações, equipe,
// limite de remarcação, tentativas) são as do Pedro, no servidor; aqui só a forma.
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const TipoDeEntrevista = z.enum(['video', 'presencial', 'telefone'])
const Canal = z.enum(['mensagem', 'ligacao'])

/** POST /api/fichas/:id/agendamentos: marcar ou remarcar a entrevista (GGVP-123). */
export const MarcacaoDaEntrevista = z.object({
  tipo: TipoDeEntrevista,
  data: Data,
  hora: Hora,
  duracao: z.number().int(),
  com: Texto(60),
  gravar: z.boolean(),
  levar: z.boolean(),
  pedirFicha: z.boolean(),
  confirmarHorarioOcupado: z.boolean(),
  remarcar: z.object({ agendamentoId: Texto(120), motivo: Texto(500) }).optional(),
})
export type MarcacaoDaEntrevista = z.infer<typeof MarcacaoDaEntrevista>

/** POST /api/fichas/:id/entrevistas/agora: a pessoa já está aqui (GGVP-40). */
export const EntrevistaAgora = z.object({ tipo: TipoDeEntrevista, com: Texto(60), duracao: z.number().int(), gravar: z.boolean() })
export type EntrevistaAgora = z.infer<typeof EntrevistaAgora>

/** POST /api/agendamentos/:id/resultado (CA6, CA8). */
export const ResultadoDoCompromisso = z.object({ resultado: z.enum(['realizado', 'faltou']) })
export type ResultadoDoCompromisso = z.infer<typeof ResultadoDoCompromisso>

/** POST /api/agendamentos/:id/convite e /confirmacao/mensagem: a mensagem conferida e enviada no Chatwoot. */
export const MensagemEnviada = z.object({ mensagem: Texto(2000) })
export type MensagemEnviada = z.infer<typeof MensagemEnviada>

/** POST /api/agenda/internos: compromisso sem cliente (CA5). */
export const NovoCompromissoInterno = z.object({ titulo: Texto(80), data: Data, hora: Hora, duracao: z.number().int(), responsavel: Texto(60) })
export type NovoCompromissoInterno = z.infer<typeof NovoCompromissoInterno>

/** POST /api/fichas/:id/encaminhamentos: o balcão manda ao setor (GGVP-16 CA4, GGVP-17 CA1). */
export const EncaminhamentoDoBalcao = z.object({
  motivo: z.enum(['entrevista', 'outra-etapa', 'documento']),
  setor: z.enum(['Jurídico', 'Documentação · ADM', 'Financeiro', 'Atendimento']),
})
export type EncaminhamentoDoBalcao = z.infer<typeof EncaminhamentoDoBalcao>

/** POST /api/agendamentos/:id/confirmacao: o que o lead respondeu (GGVP-21). */
export const ConfirmacaoDoLead = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('confirmou'), canal: Canal, jaPreencheuFicha: z.boolean() }),
  z.object({ resultado: z.literal('sem-resposta'), canal: Canal }),
])
export type ConfirmacaoDoLead = z.infer<typeof ConfirmacaoDoLead>

// Bloco 3a (GGVP-125): a entrevista gravada e a transcrição (GGVP-40, GGVP-46). Gravação e transcrição seguem simuladas.
/** POST /api/entrevistas/:id/gravacoes: só grava com o aviso ao cliente (G10). */
export const InicioDaGravacao = z.object({ avisei: z.literal(true) })
export type InicioDaGravacao = z.infer<typeof InicioDaGravacao>

/** POST /api/gravacoes/:id/acoes: cada ação com o ponto do áudio, em segundos. */
export const AcaoNaGravacaoPedida = z.object({ acao: z.enum(['pausou', 'retomou', 'abriu-cofre', 'guardou-senha', 'falhou']), aos: z.number().min(0) })
export type AcaoNaGravacaoPedida = z.infer<typeof AcaoNaGravacaoPedida>

/** POST /api/gravacoes/:id/encerrar: sem internet, o áudio espera no computador (CA12). */
export const FimDaGravacao = z.object({ aos: z.number().min(0), online: z.boolean() })
export type FimDaGravacao = z.infer<typeof FimDaGravacao>

/** POST /api/gravacoes/:id/sem-audio: a gravação falhou e a advogada escreve o que foi conversado (CA8). */
export const EntrevistaSemAudio = z.object({ notas: Texto(4000) })
export type EntrevistaSemAudio = z.infer<typeof EntrevistaSemAudio>

/** POST /api/entrevistas/:id/audio: o áudio gravado fora do portal (CA9, CA10); simulado: o nome, o tipo e o tamanho. */
export const AudioGravadoFora = z.object({ nome: Texto(200), tipo: Texto(100), tamanho: z.number().int().min(0) })
export type AudioGravadoFora = z.infer<typeof AudioGravadoFora>

/** POST /api/gravacoes/:id/transcricao: `falhar` simula a falha do serviço (GGVP-46 CA3). */
export const PedidoDeTranscricao = z.object({ falhar: z.boolean().optional() })
export type PedidoDeTranscricao = z.infer<typeof PedidoDeTranscricao>

/** POST /api/gravacoes/:id/conferencias: só o que a advogada conferiu sai da transcrição (CA6, G14). */
export const ConferenciaDaTranscricao = z.object({ ids: z.array(Texto(60)).min(1).max(50) })
export type ConferenciaDaTranscricao = z.infer<typeof ConferenciaDaTranscricao>

/** POST /api/gravacoes/:id/documentos: a lista conferida vai ao checklist do benefício (CA7). */
export const DocumentosDaEntrevista = z.object({ documentos: z.array(Texto(200)).min(1).max(50) })
export type DocumentosDaEntrevista = z.infer<typeof DocumentosDaEntrevista>

/** PATCH /api/gravacoes/:id/trechos/:aos: marca ou desmarca o trecho como prova (CA6). */
export const ProvaNoTrecho = z.object({ prova: z.boolean() })
export type ProvaNoTrecho = z.infer<typeof ProvaNoTrecho>

/** POST /api/fichas/:id/conversas: a conversa sem áudio, escrita por quem participou (GGVP-46 CA6). */
export const ConversaRegistrada = z.object({
  data: Texto(10),
  canal: z.enum(['WhatsApp', 'Telefone', 'Presencial', 'Vídeo']),
  titulo: Texto(200),
  participantes: Texto(200),
  texto: Texto(5000),
  perfil: z.enum(['juridico', 'atendimento']),
})
export type ConversaRegistrada = z.infer<typeof ConversaRegistrada>

// Bloco 3b (GGVP-125): as decisões depois da entrevista. As regras (campos do cadastro, requisitos, cálculo, motivos de
// não fechar, G16) são as do Pedro, no servidor; aqui só a forma.
const DoCadastro = z.object({
  nome: Texto(200),
  cpf: Texto(20),
  rg: Texto(30),
  nascimento: Texto(10),
  estadoCivil: Texto(60),
  profissao: Texto(120),
  telefone: Texto(30),
  cep: Texto(10),
  rua: Texto(300),
  bairro: Texto(120),
  cidade: Texto(120),
  uf: Texto(2),
})
const Representante = z.object({ nome: Texto(200), cpf: Texto(20), rg: Texto(30), parentesco: Texto(60), estadoCivil: Texto(60), profissao: Texto(120) })

/** PUT /api/fichas/:id/cadastro: `base` é o que a tela abriu, para não apagar o que outra pessoa salvou (GGVP-43 CA11). */
export const PedidoDeCadastro = z.object({ base: DoCadastro, valores: DoCadastro, representante: Representante.optional() })
export type PedidoDeCadastro = z.infer<typeof PedidoDeCadastro>

/** POST /api/entrevistas/:id/analise: "Pode ser auxílio acidentário?" (GGVP-28). */
export const AnaliseDaFicha = z.object({ acidentario: z.boolean() })
export type AnaliseDaFicha = z.infer<typeof AnaliseDaFicha>

/** POST /api/entrevistas/:id/beneficio: a advogada decide, conferindo a sugestão com a entrevista (GGVP-51, G3). */
export const DecisaoDoBeneficio = z.object({ beneficio: Texto(100), conferi: z.literal(true), motivoDaRecusa: Opcional(500) })
export type DecisaoDoBeneficio = z.infer<typeof DecisaoDoBeneficio>

const Tempo = z.object({ anos: z.number().int().min(0), meses: z.number().int().min(0), dias: z.number().int().min(0) })
/** POST /api/entrevistas/:id/calculo: o advogado registra o que calculou sobre o CNIS; nenhum número vem da IA (G19). */
export const RegistroDoCalculo = z.discriminatedUnion('podeAposentar', [
  z.object({ podeAposentar: z.literal(true), tempo: Tempo, pontos: z.number().min(0), regra: Texto(200), conferi: z.literal(true) }),
  z.object({ podeAposentar: z.literal(false), tempo: Tempo, pontos: z.number().min(0), regra: Texto(200), dataPrevista: Texto(10), conferi: z.literal(true) }),
])
export type RegistroDoCalculo = z.infer<typeof RegistroDoCalculo>

const Espera = z.enum(['pensar', 'esperar'])
/** POST /api/fichas/:id/fechamento: "Fechou com o escritório?" (GGVP-60, G16). O papel vem da sessão, não daqui. */
export const EnvioDoFechamento = z.discriminatedUnion('fechou', [
  z.object({ fechou: z.literal(true) }),
  z.object({
    fechou: z.literal(false),
    motivo: Texto(60),
    detalhe: Opcional(2000),
    recontatar: z.object({ data: Texto(10), espera: Espera.optional() }).nullable(),
  }),
])
export type EnvioDoFechamento = z.infer<typeof EnvioDoFechamento>

/** POST /api/fichas/:id/recontato: o resultado do recontato (GGVP-60 CA10). O papel vem da sessão. */
export const ResultadoDoRecontato = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('calculo') }),
  z.object({ resultado: z.literal('nova-data'), data: Texto(10), espera: Espera.optional() }),
  z.object({ resultado: z.literal('arquivar'), motivo: Texto(60), detalhe: Opcional(2000) }),
])
export type ResultadoDoRecontato = z.infer<typeof ResultadoDoRecontato>

/** POST /api/fichas/:id/demandas: a nova demanda de quem já é cliente (GGVP-124). Quem abriu vem da sessão. */
export const EnvioDaDemanda = z.object({ pretende: Texto(2000), beneficio: Texto(100), tipo: z.enum(['outro-pedido', 'tentar-de-novo', 'recurso-ou-defesa']) })
export type EnvioDaDemanda = z.infer<typeof EnvioDaDemanda>

/**
 * POST /api/fichas/:id/cofre/gov: a situação da senha na ficha (G9). "guardou" só depois de a senha ir ao cofre do portal
 * (`POST /api/pessoas/:id/cofre`); a senha nunca passa por aqui.
 */
export const SituacaoDaSenhaGov = z.object({ acao: z.enum(['guardou', 'nao-sabe', 'conferiu']) })
export type SituacaoDaSenhaGov = z.infer<typeof SituacaoDaSenhaGov>

/** POST /api/entrevistas/:id/renovacao (GGVP-36): "renovou" só depois de a senha nova ir ao cofre do portal. */
export const RenovacaoDaSenha = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('renovou'), conferiMeuInss: z.literal(true) }),
  z.object({ resultado: z.literal('nao-conseguiu'), motivo: Texto(300), aviseiOCliente: z.literal(true) }),
])
export type RenovacaoDaSenha = z.infer<typeof RenovacaoDaSenha>

// Bloco 3c (GGVP-125): a segunda ficha (auxílio acidentário, GGVP-28). Os campos e as regras são os das telas; o servidor
// fica só com os campos que conhece e guarda a seção médica à parte.
/** PUT /api/fichas/:id/segunda-ficha: as respostas, campo a campo, e de onde vieram. */
export const EnvioDaSegundaFicha = z.object({ respostas: z.record(z.string().max(40), Texto(4000)), origem: z.enum(['papel', 'tablet']) })
export type EnvioDaSegundaFicha = z.infer<typeof EnvioDaSegundaFicha>

// Bloco 4a (GGVP-125): fechar e preparar o contrato (GGVP-65, GGVP-69). O kit, os campos do modelo e as conferências são
// os das telas, no servidor; aqui só a forma.
/** POST /api/fichas/:id/processos: o cliente fechou o benefício; nasce o caso, com o contrato e o kit. */
export const FechamentoDoCaso = z.object({ beneficio: Texto(100) })
export type FechamentoDoCaso = z.infer<typeof FechamentoDoCaso>

/** PUT /api/processos/:id/contrato/condicoes: o que o caso diz e muda o kit do LOAS (GGVP-65 CA2, CA8). */
export const CondicoesDoKit = z.object({ representado: z.boolean(), moradia: z.boolean(), uniaoEstavel: z.boolean(), separacaoDeFato: z.boolean() })
export type CondicoesDoKit = z.infer<typeof CondicoesDoKit>

/** POST /api/processos/:id/contrato/gerar: a decisão, o que corrigir, as conferências e as correções (GGVP-69). */
export const EnvioDoContrato = z.object({
  aprovados: z.boolean(),
  oQueCorrigir: Opcional(500),
  conferencias: z.record(z.string().max(40), z.boolean()),
  correcoes: z.record(z.string().max(40), Texto(300)),
})
export type EnvioDoContrato = z.infer<typeof EnvioDoContrato>

/** POST /api/processos/:id/contrato/tentativas: o link ou o lembrete, pelo WhatsApp (com a mensagem) ou por ligação (GGVP-72). */
export const TentativaDoContrato = z.object({ canal: z.enum(['whatsapp', 'ligacao']), mensagem: Opcional(2000) })
export type TentativaDoContrato = z.infer<typeof TentativaDoContrato>

/** POST /api/processos/:id/contrato/verificacao: "está certo" ou o que corrigir, com a página corrigida (GGVP-85). */
export const VerificacaoDoContrato = z.object({
  tudoCerto: z.boolean(),
  oQueCorrigir: Opcional(500),
  paginaCorrigida: z.object({ nome: Texto(200), tamanho: z.number().int().min(0) }).optional(),
})
export type VerificacaoDoContrato = z.infer<typeof VerificacaoDoContrato>

/** POST /api/processos/:id/contrato/copia/visita: a data e a hora da visita para retirar a cópia (GGVP-89 CA4). */
export const VisitaDaCopia = z.object({ data: Texto(10), hora: Texto(5) })
export type VisitaDaCopia = z.infer<typeof VisitaDaCopia>

/** POST /api/processos/:id/contrato/copia/entrega: a confirmação, a data, quem recebeu e a observação (GGVP-89 CA3). */
export const EntregaDaCopia = z.object({ copiaDaVersaoAssinada: z.boolean(), entregueEm: Texto(10), quemRecebeu: Texto(120), observacao: Texto(500) })
export type EntregaDaCopia = z.infer<typeof EntregaDaCopia>
