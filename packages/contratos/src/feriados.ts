// Feriados e suspensões dos tribunais (GGVP-146, parte 3), na Configuração do escritório: a Sênior mantém a lista que a
// contagem de prazo usa (tabela `feriado`, GGVP-34), com histórico.
import { normalizarInteiro, validarData, validarInteiro } from '@ggv/campos'
import { z } from 'zod'

/** Os tribunais que o portal conhece, pelo "J.TR" do número CNJ (o mesmo da jurimetria). Sem tribunal: nacional. */
export const TRIBUNAIS_CONHECIDOS = { '4.01': 'TRF1', '4.02': 'TRF2', '4.03': 'TRF3', '4.04': 'TRF4', '4.05': 'TRF5', '4.06': 'TRF6', '8.26': 'TJSP' } as const
export type TribunalConhecido = keyof typeof TRIBUNAIS_CONHECIDOS
const TRIBUNAIS = Object.keys(TRIBUNAIS_CONHECIDOS) as [TribunalConhecido, ...TribunalConhecido[]]

/** Os anos que o portal carrega da lei. */
export const ANOS_DE_FERIADOS = [2026, 2027] as const

/**
 * POST /api/configuracao/feriados/carga (GGVP-158 P5.11): sem ano, os de `ANOS_DE_FERIADOS`; com ele, os da lei daquele
 * ano. A Páscoa sai da conta, então qualquer ano serve.
 */
export const CargaDeFeriados = z.object({
  ano: z
    .unknown()
    .optional()
    .refine((v) => v === undefined || validarInteiro(v), 'Informe o ano com quatro dígitos')
    .transform((v) => (v === undefined ? null : (normalizarInteiro(v) as number)))
    .refine((v) => v === null || (v >= 2020 && v <= 2100), 'O ano vai de 2020 a 2100'),
})

export const FeriadoDoTribunal = z.object({ id: z.uuid(), data: z.string(), tribunal: z.enum(TRIBUNAIS).nullable(), descricao: z.string() })
export type FeriadoDoTribunal = z.infer<typeof FeriadoDoTribunal>

/** GET /api/configuracao/feriados: a lista, o histórico das mudanças e se quem vê pode mudar. */
export const FeriadosDoEscritorio = z.object({
  feriados: z.array(FeriadoDoTribunal),
  historico: z.array(z.object({ quando: z.string(), quem: z.string(), descricao: z.string() })),
  podeEditar: z.boolean(),
})
export type FeriadosDoEscritorio = z.infer<typeof FeriadosDoEscritorio>

/** POST /api/configuracao/feriados: o dia (dd/mm/aaaa), o tribunal (nulo: nacional) e o que é. */
export const NovoFeriado = z.object({
  data: z.string().refine(validarData, 'Data inválida: use dd/mm/aaaa.'),
  tribunal: z.enum(TRIBUNAIS).nullable(),
  descricao: z.string().trim().min(3, 'Escreva o que é o feriado ou a suspensão.').max(120, 'Descrição longa demais.'),
})
export type NovoFeriado = z.infer<typeof NovoFeriado>
