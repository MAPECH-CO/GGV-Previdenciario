// Painel de resultado para os sócios (GGVP-75): o contrato da Gestão · Resultados. O cálculo é do servidor (CA7).
import { dataParaIso, validarData } from '@ggv/campos'
import { z } from 'zod'

/** G22 (CA8): abaixo de 8 casos no denominador, a taxa não sai. É o mínimo que a Gestão do protótipo usa. */
export const AMOSTRA_MINIMA = 8

export const RECORTES = ['beneficio', 'perito', 'juizo', 'advogada'] as const
export const Recorte = z.enum(RECORTES)
export type Recorte = z.infer<typeof Recorte>
export const ROTULO_RECORTE: Record<Recorte, string> = { beneficio: 'Benefício', perito: 'Perito', juizo: 'Juízo', advogada: 'Advogada' }

const data = (rotulo: string) =>
  z
    .string()
    .refine(validarData, `Informe a data ${rotulo} (dd/mm/aaaa)`)
    .transform((d) => dataParaIso(d) as string)

/** GET /api/gestao/resultados: o período (dd/mm/aaaa) e o recorte, todos opcionais. */
export const PedidoDoPainel = z.object({ de: data('inicial').optional(), ate: data('final').optional(), recorte: Recorte.optional() })
export type PedidoDoPainel = z.input<typeof PedidoDoPainel>

export const SITUACOES_INDICADOR = ['ok', 'amostra_insuficiente', 'sem_dados'] as const

/** Um número do painel, sempre com quantos casos o compõem (CA1). `valor` é nulo quando a amostra não basta. */
export const Indicador = z.object({
  chave: z.string(),
  rotulo: z.string(),
  casos: z.number().int().nonnegative(),
  /** Taxa de 0 a 1, dias ou casos, conforme a `unidade`. */
  valor: z.number().nullable(),
  unidade: z.enum(['taxa', 'dias', 'casos']),
  situacao: z.enum(SITUACOES_INDICADOR),
})
export type Indicador = z.infer<typeof Indicador>

/** Os agregados do Raio-X Previdenciário GGV (CA5). O arquivo, com nome de cliente e dado de saúde, não entra. */
export const RAIO_X = {
  processos: 979,
  geradoEm: '2026-09-21',
  indicadores: [
    { rotulo: 'Êxito nos decididos, por safra', valor: '9% → 25% → 36%' },
    { rotulo: 'Falha nossa provada, por safra', valor: '52% → 38% → 30%' },
    { rotulo: 'Laudo médico favorável', valor: '44%' },
    { rotulo: 'Extinção por não cumprir determinação', valor: '24% → 2%' },
    { rotulo: 'Cliente que faltou à perícia', valor: '3% → 6%' },
    { rotulo: 'Recurso provido', valor: '5% a 8%' },
  ],
  /** Certidões de irregularidade: o que o cartório mais cobra na inicial; cada item vira checklist de distribuição. */
  cartorioCobra: {
    processos: 588,
    itens: [
      { item: 'Comprovante de residência', vezes: 286 },
      { item: 'Telefone de contato do autor', vezes: 231 },
      { item: 'Endereço: croqui / ponto de referência', vezes: 223 },
      { item: 'Cópia integral do processo administrativo', vezes: 97 },
      { item: 'Valor da causa / planilha / renúncia', vezes: 89 },
      { item: 'Documentos médicos (CRM, data, CID)', vezes: 86 },
      { item: 'Procuração (atual, cláusulas)', vezes: 72 },
    ],
  },
  /** Onde julgam: o foro pelo código de origem do CNJ, com o êxito sobre o total do foro. */
  ondeJulgam: [
    { foro: 'JEF São Paulo', processos: 479, exito: '22%' },
    { foro: 'JEF Mauá', processos: 111, exito: '16%' },
    { foro: 'JEF Guarulhos', processos: 36, exito: '19%' },
    { foro: 'Varas Previdenciárias SP', processos: 18, exito: '28%' },
    { foro: 'Varas Cíveis SP', processos: 17, exito: '53%' },
    { foro: 'JEF Osasco / Santo André', processos: 14, exito: '21%' },
  ],
} as const

export const PainelDeResultados = z.object({
  periodo: z.object({ de: z.string(), ate: z.string() }),
  indicadores: z.array(Indicador),
  recorte: z.object({ por: Recorte, grupos: z.array(z.object({ nome: z.string(), indicadores: z.array(Indicador) })) }).nullable(),
  /** CA2: em destaque, com a causa registrada; a meta é zero. `decididos`: os casos decididos no período. */
  extincoes: z.object({ casos: z.number().int(), decididos: z.number().int(), porCausa: z.array(z.object({ causa: z.string(), casos: z.number().int() })) }),
  /** CA3: os dispensados pela Sênior contra os "Suficiente". */
  pareceres: z.object({ dispensados: z.number().int(), exitoComDispensa: Indicador, exitoComSuficiente: Indicador }),
  /** CA4: só para quem tem `valores.ver_totais` (Sócio e Financeiro); nulo para os outros. */
  totais: z.object({ honorariosRecebidos: z.string(), recebimentos: z.number().int(), diasAteReceber: Indicador }).nullable(),
  /** CA5: "sem dados ainda" enquanto o escritório não tiver caso decidido no portal. */
  operacao: z.enum(['com_dados', 'sem_dados']),
  /** CA6: o acervo ainda não existe (GGVP-55). */
  baseDoAcervo: z.object({ situacao: z.literal('sem_dados') }),
})
export type PainelDeResultados = z.infer<typeof PainelDeResultados>
