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
