// Painel de resultado para os sócios (GGVP-75): o contrato da Gestão · Resultados. O cálculo é do servidor (CA7).
import { dataParaIso, validarData } from '@ggv/campos'
import { z } from 'zod'

/** GGVP-41 (CA3): a tese vem da ficha do desfecho conferida pela Sênior. */
export const RECORTES = ['beneficio', 'perito', 'juizo', 'advogada', 'tese'] as const
export const Recorte = z.enum(RECORTES)
export type Recorte = z.infer<typeof Recorte>
export const ROTULO_RECORTE: Record<Recorte, string> = { beneficio: 'Benefício', perito: 'Perito', juizo: 'Juízo', advogada: 'Advogada', tese: 'Tese' }

const data = (rotulo: string) =>
  z
    .string()
    .refine(validarData, `Informe a data ${rotulo} (dd/mm/aaaa)`)
    .transform((d) => dataParaIso(d) as string)

/** GET /api/gestao/resultados: o período (dd/mm/aaaa) e o recorte, todos opcionais. */
export const PedidoDoPainel = z.object({ de: data('inicial').optional(), ate: data('final').optional(), recorte: Recorte.optional() })
export type PedidoDoPainel = z.input<typeof PedidoDoPainel>

/** Um número do painel, sempre com quantos casos o compõem (CA1). `valor` é nulo só sem nenhum caso. */
export const Indicador = z.object({
  chave: z.string(),
  rotulo: z.string(),
  casos: z.number().int().nonnegative(),
  /** Taxa de 0 a 1, dias ou casos, conforme a `unidade`. */
  valor: z.number().nullable(),
  unidade: z.enum(['taxa', 'dias', 'casos']),
  /** G22 (regra de 07/10): não há amostra mínima; só "sem_dados" quando não há nenhum caso (CA5, CA8). */
  situacao: z.enum(['ok', 'sem_dados']),
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
  /** CA6 e GGVP-55 CA3: a base do acervo, com os que aguardam conferência fora das contas; sem acervo, "sem dados ainda". */
  baseDoAcervo: z.discriminatedUnion('situacao', [
    z.object({ situacao: z.literal('sem_dados') }),
    z.object({
      situacao: z.literal('com_dados'),
      processos: z.number().int(),
      conferidos: z.number().int(),
      aguardandoConferencia: z.number().int(),
      /** AAAA-MM-DD: a entrada mais recente, em Brasília. */
      dataDaBase: z.string(),
    }),
  ]),
})
export type PainelDeResultados = z.infer<typeof PainelDeResultados>
