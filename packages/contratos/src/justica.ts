// Contratos da vigília e da publicação (GGVP-9, grupo 1). Tela e servidor validam com o mesmo schema.
import { dataParaIso, normalizarCnj, normalizarInteiro, validarCnj, validarData } from '@ggv/campos'
import { z } from 'zod'
import { Lembrete, TentativaDoLaco } from './exigencia.ts'
import { DataObrigatoria, TIPOS_DE_PERICIA, naoFutura } from './inss.ts'
import { SugestaoDaIa } from './ia.ts'

export const CLASSES_DE_ATO = ['andamento', 'exigencia', 'merito', 'nomeacao_perito'] as const
export const ROTULO_CLASSE: Record<(typeof CLASSES_DE_ATO)[number], string> = {
  andamento: 'Só andamento',
  exigencia: 'Intimação ou exigência',
  merito: 'Decisão de mérito',
  nomeacao_perito: 'Nomeação de perito',
}
export const PRAZO_SEM_DIAS_NA_DECISAO = 5
/** GGVP-59 CA1: CPC, art. 465, §1º: 15 dias para quesitos, assistente técnico e impugnação do perito. */
export const PRAZO_DOS_QUESITOS = 15

const Prazo = z.object({ inicio: z.string(), fim: z.string(), regra: z.string(), versao: z.number() })

/** GGVP-64 parte 2 (CA1): a vara e o juiz, como estão escritos na publicação. */
export const TAMANHO_DA_VARA = 120
const daVara = (rotulo: string) => z.string().trim().max(TAMANHO_DA_VARA, `${rotulo} tem até ${TAMANHO_DA_VARA} caracteres`).optional()

/**
 * POST /api/publicacoes/:id/classificacao (GGVP-34, GGVP-37, GGVP-59): a pessoa classifica; só o andamento não pede os
 * dias. GGVP-64 parte 2: a vara e o juiz conferidos vão junto; vazios, o caso fica com o que já tinha.
 */
export const ClassificarPublicacao = z
  .object({
    classe: z.enum(CLASSES_DE_ATO, { error: 'Escolha o tipo de ato' }),
    semPrazoNaDecisao: z.boolean().default(false),
    dias: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v === undefined || v === '' ? null : normalizarInteiro(v))),
    vara: daVara('A vara'),
    juiz: daVara('O nome do juiz'),
  })
  .refine((c) => c.classe === 'andamento' || c.semPrazoNaDecisao || (c.dias !== null && c.dias >= 1 && c.dias <= 120), {
    message: 'Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"',
    path: ['dias'],
  })
  .transform((c) => ({
    classe: c.classe,
    // Sem prazo na decisão: 5 dias (CPC, art. 218, §3º); na nomeação de perito, os 15 dos quesitos (art. 465, §1º).
    dias:
      c.classe === 'andamento'
        ? null
        : c.semPrazoNaDecisao
          ? c.classe === 'nomeacao_perito'
            ? PRAZO_DOS_QUESITOS
            : PRAZO_SEM_DIAS_NA_DECISAO
          : (c.dias as number),
    vara: c.vara || null,
    juiz: c.juiz || null,
  }))
export type ClassificarPublicacao = z.input<typeof ClassificarPublicacao>

/** GET /api/publicacoes/:id (GGVP-74 CA4, GGVP-34 CA3). */
export const PublicacaoParaLer = z.object({
  id: z.uuid(),
  casoId: z.uuid().nullable(),
  cliente: z.string().nullable(),
  numeroCnj: z.string().nullable(),
  fonte: z.string(),
  disponibilizadaEm: z.string(),
  texto: z.string(),
  classe: z.enum(CLASSES_DE_ATO).nullable(),
  classificadaPor: z.string().nullable(),
  classificadaEm: z.string().nullable(),
  prazo: Prazo.nullable(),
  feriadosCadastrados: z.boolean(),
  podeClassificar: z.boolean(),
})
export type PublicacaoParaLer = z.infer<typeof PublicacaoParaLer>

/** A vara ou o juiz que a IA leu: vazio é o mesmo que não estar escrito; o longo é cortado no tamanho do campo. */
const lidoNoTexto = z.string().trim().nullable().default(null).transform((t) => (t ? t.slice(0, TAMANHO_DA_VARA) : null))

/**
 * O que a IA devolve na leitura da publicação (GGVP-34, GGVP-74): só lê os dias escritos; a data final é do código.
 * GGVP-64 parte 2 (CA1): a vara e o juiz, quando estão escritos; a pessoa confere.
 */
export const LeituraDaPublicacaoPelaIa = z.object({
  classe: z.enum(CLASSES_DE_ATO),
  dias: z.number().int().min(1).max(120).nullable(),
  resumo: z.string().trim().min(1),
  vara: lidoNoTexto,
  juiz: lidoNoTexto,
})
/** POST /api/publicacoes/:id/sugestao. Sem sugestão (sem chave, falha ou fora do formato): `sugestao` nulo e o motivo. */
export const SugestaoDePublicacao = z.object({
  sugestao: LeituraDaPublicacaoPelaIa.extend({ chamadaId: z.uuid(), modelo: z.string(), alerta: z.string().nullable() }).nullable(),
  motivo: z.string().nullable(),
})
export type SugestaoDePublicacao = z.infer<typeof SugestaoDePublicacao>

/** GET /api/casos/:id/publicacoes (GGVP-74 CA5, CA7). */
export const PublicacoesDoCaso = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  publicacoes: z.array(
    z.object({
      id: z.uuid(),
      disponibilizadaEm: z.string(),
      fonte: z.string(),
      trecho: z.string(),
      classe: z.enum(CLASSES_DE_ATO).nullable(),
      classificadaPor: z.string().nullable(),
      prazo: Prazo.nullable(),
    }),
  ),
})
export type PublicacoesDoCaso = z.infer<typeof PublicacoesDoCaso>

/** Item da fila de revisão da Sênior (GGVP-26 CA7, CA10, CA12). */
export const ItemDaFila = z.object({
  id: z.uuid(),
  fonte: z.string(),
  disponibilizadaEm: z.string(),
  texto: z.string(),
  partes: z.string().nullable(),
  numeroCnj: z.string().nullable(),
  motivo: z.string(),
  idadeEmDias: z.number(),
  prazoMinimo: Prazo,
  diasUteisAtePrazo: z.number(),
})
export type ItemDaFila = z.infer<typeof ItemDaFila>

/** POST /api/publicacoes/:id/vinculo (GGVP-26 CA8): vincular com CNJ válido, ou registrar que não é do escritório. */
export const VincularPublicacao = z.discriminatedUnion(
  'decisao',
  [
    z.object({
      decisao: z.literal('vincular'),
      numeroCnj: z
        .string({ error: 'Informe o número CNJ do processo' })
        .refine(validarCnj, 'Número CNJ inválido. Confira os 20 dígitos.')
        .transform((v) => normalizarCnj(v)),
    }),
    z.object({ decisao: z.literal('fora_do_escritorio') }),
  ],
  { error: 'Escolha "Vincular a um processo" ou "Não é do escritório"' },
)
export type VincularPublicacao = z.input<typeof VincularPublicacao>

/** GET /api/vigilia (GGVP-30 CA2, CA4, CA5, CA12; GGVP-26 CA6). */
export const PainelDaVigilia = z.object({
  dia: z.string(),
  situacaoDoDia: z.enum(['ok', 'incompleta', 'sem_publicacao', 'em_andamento']),
  rodadas: z.array(
    z.object({
      id: z.uuid(),
      fonte: z.string(),
      previstaPara: z.string(),
      situacao: z.enum(['prevista', 'rodando', 'ok', 'falhou', 'nao_rodou']),
      inicio: z.string().nullable(),
      fim: z.string().nullable(),
      capturadas: z.number(),
      erro: z.string().nullable(),
      reprocessadaPor: z.string().nullable(),
      reprocessadaEm: z.string().nullable(),
    }),
  ),
  previstas: z.number(),
  concluidas: z.number(),
  falhas: z.number(),
  fila: z.array(ItemDaFila),
  descartes: z.array(z.object({ quando: z.string(), fonte: z.string(), numeroCnj: z.string().nullable(), trecho: z.string(), motivo: z.string() })),
  podeReprocessar: z.boolean(),
  podeCasar: z.boolean(),
})
export type PainelDaVigilia = z.infer<typeof PainelDaVigilia>

/** Setores que cumprem a exigência do juiz (GGVP-79 CA1). O "Jurídico" é o Jurídico administrativo (revisor, 06/10). */
export const SETORES_DA_EXIGENCIA = ['atendimento', 'juridico_adm', 'documentacao'] as const
export const ROTULO_SETOR: Record<(typeof SETORES_DA_EXIGENCIA)[number], string> = {
  atendimento: 'Atendimento',
  juridico_adm: 'Jurídico',
  documentacao: 'Documentação',
}

const ItemDaExigenciaJuiz = z.object({
  setor: z.enum(SETORES_DA_EXIGENCIA, { error: 'Escolha o setor de cada item' }),
  descricao: z.string({ error: 'Descreva o que o setor deve cumprir' }).trim().min(1, 'Descreva o que o setor deve cumprir'),
  provaEsperada: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  prazoInterno: DataObrigatoria('Informe o prazo interno de cada item (dd/mm/aaaa)'),
  /** O tipo de documento que cumpre o item, se houver: o documento conferido desse tipo dá baixa sozinho (GGVP-125, bloco 5d). */
  tipoDocumento: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
})

/** POST /api/casos/:id/exigencia-juiz (GGVP-79 CA1, CA2, CA6, CA7, CA8, CA13): "o prazo interno até o processual" o servidor confere. */
export const AnalisarExigenciaJuiz = z.discriminatedUnion(
  'decisao',
  [
    // Épico IA (GGVP-79 CA3): a decisão que partiu da sugestão guarda a chamada à parte do que a advogada escolheu.
    z.object({ decisao: z.literal('ciencia'), chamadaIaId: z.uuid().optional() }),
    z
      .object({
        decisao: z.literal('cumprir'),
        itens: z.array(ItemDaExigenciaJuiz).default([]),
        tiposPericia: z.array(z.enum(TIPOS_DE_PERICIA)).default([]),
        chamadaIaId: z.uuid().optional(),
      })
      .refine((d) => d.itens.length > 0 || d.tiposPericia.length > 0, { message: 'Inclua ao menos um item ou a perícia', path: ['itens'] }),
  ],
  { error: 'Escolha "Só ciência" ou "Precisa cumprir"' },
)
export type AnalisarExigenciaJuiz = z.input<typeof AnalisarExigenciaJuiz>

/** Épico IA (GGVP-79 CA3): o que a IA devolve, em JSON. "Só ciência" sem itens; senão, os itens por setor e a perícia. */
export const AnaliseDaExigenciaPelaIa = z.object({
  resumo: z.string().trim().min(1),
  ciencia: z.boolean(),
  itens: z
    .array(
      z.object({
        setor: z.enum(SETORES_DA_EXIGENCIA),
        descricao: z.string().trim().min(1),
        provaEsperada: z.string().trim().nullable().default(null),
        tipoDocumento: z.string().trim().nullable().default(null),
      }),
    )
    .default([]),
  pericias: z.array(z.enum(TIPOS_DE_PERICIA)).default([]),
})
export type AnaliseDaExigenciaPelaIa = z.infer<typeof AnaliseDaExigenciaPelaIa>

/** POST /api/casos/:id/exigencia-juiz/sugestao. Sem sugestão (sem chave, falha, fora do formato): `leitura` nula e o motivo. */
export const SugestaoDaExigencia = z.object({
  sugestao: SugestaoDaIa.nullable(),
  leitura: AnaliseDaExigenciaPelaIa.nullable(),
  motivo: z.string().nullable(),
  aviso: z.string().nullable(),
})
export type SugestaoDaExigencia = z.infer<typeof SugestaoDaExigencia>

/** GET /api/casos/:id/exigencia-juiz (GGVP-79 CA5; GGVP-83 CA2, CA3, CA10). */
export const ExigenciaDoJuiz = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  publicacaoId: z.uuid(),
  texto: z.string(),
  disponibilizadaEm: z.string(),
  prazo: Prazo,
  /** `a_analisar`: ninguém decidiu; `ciencia`; `em_cumprimento`; `cumprida`; `vencida`; `dilacao_pedida`. */
  situacao: z.enum(['a_analisar', 'ciencia', 'em_cumprimento', 'cumprida', 'vencida', 'dilacao_pedida']),
  itens: z.array(
    z.object({
      id: z.uuid(),
      setor: z.enum(SETORES_DA_EXIGENCIA),
      descricao: z.string(),
      provaEsperada: z.string().nullable(),
      prazoInterno: z.string().nullable(),
      situacao: z.enum(['pendente', 'cumprido', 'nao_cumprido']),
      /** Encerrado sem a prova pela advogada: o motivo é a prova em texto (GGVP-68 CA2). */
      motivo: z.string().nullable(),
      prova: z.string().nullable(),
      tentativas: z.number(),
      limite: z.number().nullable(),
      escalada: z.boolean(),
      /** GGVP-68 CA14: quando o setor foi acionado e o laço (tentativas e decisões da Sênior), do mais antigo ao mais novo. */
      acionadoEm: z.string().nullable(),
      historicoDoLaco: z.array(TentativaDoLaco),
      /** GGVP-94 CA9: a Sênior decide o item que passou do limite. */
      podeDecidir: z.boolean(),
    }),
  ),
  /** GGVP-68 CA5: a peça que cumpriu os itens, depois do protocolo da manifestação. */
  peca: z.object({ versao: z.number(), protocoladaEm: z.string() }).nullable(),
  pericias: z.array(z.object({ tipo: z.enum(TIPOS_DE_PERICIA), resultado: z.string().nullable() })),
  /** Setores que ainda não subiram o card (GGVP-83 CA3). */
  faltam: z.array(z.string()),
  podeDistribuir: z.boolean(),
  /** GGVP-87 CA4: vencida com item sem prova, a Sênior pede dilação ou registra a perda. */
  vencida: z.boolean(),
  podeDecidirVencida: z.boolean(),
})
export type ExigenciaDoJuiz = z.infer<typeof ExigenciaDoJuiz>

/**
 * GET /api/casos/:id/exigencia-juiz/setor (GGVP-83 CA4, CA13) e /api/casos/:id/pendencias/setor (GGVP-58 CA5, CA13):
 * os itens do setor do perfil ativo. No despacho da Sênior, antes da ação, não há prazo processual.
 */
export const ItensDoSetor = z.object({
  origem: z.enum(['juizo', 'despacho']),
  casoId: z.uuid(),
  cliente: z.string(),
  setor: z.enum(SETORES_DA_EXIGENCIA),
  pedidoPor: z.string().nullable(),
  prazoProcessual: z.string().nullable(),
  itens: z.array(
    z.object({
      id: z.uuid(),
      descricao: z.string(),
      provaEsperada: z.string().nullable(),
      prazoInterno: z.string().nullable(),
      situacao: z.enum(['pendente', 'cumprido', 'nao_cumprido']),
      /** Encerrado sem a prova pela advogada: o motivo é a prova em texto (GGVP-68 CA2). */
      motivo: z.string().nullable(),
      prova: z.string().nullable(),
      /** A informação que o Atendimento conseguiu com o cliente (GGVP-58 CA1). */
      informacao: z.string().nullable(),
      proximoLembrete: z.string().nullable(),
      lembrete: Lembrete.nullable(),
      limite: z.number().nullable(),
      escalada: z.boolean(),
      tentativas: z.array(TentativaDoLaco),
    }),
  ),
})
export type ItensDoSetor = z.infer<typeof ItensDoSetor>

/** POST /api/casos/:id/pendencias/itens/:item/prova (GGVP-58 CA1, CA7): o Atendimento sobe com a informação escrita. */
export const SubirInformacao = z.object({
  informacao: z.string({ error: 'Escreva a informação que conseguiu com o cliente' }).trim().min(1, 'Escreva a informação que conseguiu com o cliente'),
})
export type SubirInformacao = z.infer<typeof SubirInformacao>

/** POST .../itens/:item/tentativas (GGVP-83 CA5, G15): data (a do registro), canal e resultado. */
export const RegistrarTentativa = z.object({
  canal: z.enum(['whatsapp', 'telefone', 'email', 'sms', 'presencial'], { error: 'Escolha o canal da tentativa' }),
  resultado: z.string({ error: 'Escreva o resultado da tentativa' }).trim().min(1, 'Escreva o resultado da tentativa'),
})
export type RegistrarTentativa = z.infer<typeof RegistrarTentativa>

/** POST .../itens/:item/nao-vou-conseguir (GGVP-83 CA14): sobe para a Sênior antes do limite, com o motivo. */
export const NaoVouConseguir = z.object({ motivo: z.string({ error: 'Escreva por que não vai conseguir' }).trim().min(1, 'Escreva por que não vai conseguir') })
export type NaoVouConseguir = z.infer<typeof NaoVouConseguir>

/** GET /api/casos/:id/manifestacao (GGVP-87): versões, aprovação (G6), o que falta (G21) e o protocolo. */
export const Manifestacao = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  prazo: z.object({ fim: z.string(), regra: z.string() }),
  faltam: z.array(z.string()),
  pendentes: z.array(
    z.object({ alvo: z.enum(['item', 'pericia']), id: z.uuid(), setor: z.string(), descricao: z.string(), prazoInterno: z.string().nullable() }),
  ),
  /** Itens e perícias encerrados sem a prova, com o motivo, quem e quando: a manifestação precisa explicar ao juiz. */
  semProva: z.array(z.object({ descricao: z.string(), motivo: z.string(), por: z.string(), em: z.string() })),
  versoes: z.array(
    z.object({ numero: z.number(), tipo: z.enum(['manifestacao', 'dilacao']), arquivo: z.string().nullable(), por: z.string(), em: z.string(), aprovadaPor: z.string().nullable(), aprovadaEm: z.string().nullable() }),
  ),
  dilacaoAutorizada: z.boolean(),
  protocolo: z.object({ em: z.string(), versao: z.number(), tipo: z.string(), por: z.string() }).nullable(),
  podeAnexar: z.boolean(),
  podeProtocolar: z.boolean(),
  podeAutorizarDilacao: z.boolean(),
  podeEncerrarSemProva: z.boolean(),
})
export type Manifestacao = z.infer<typeof Manifestacao>

/** POST .../manifestacao/versoes/:n/aprovacao (G6): a advogada aprova o conteúdo daquela versão. */
export const AprovarVersao = z.object({ aprovei: z.literal(true, { error: 'Marque "Aprovei a versão da manifestação (G6)"' }) })

/** POST /api/casos/:id/manifestacao/protocolo (CA3, CA12): data do protocolo; o comprovante vai no mesmo envio. */
export const ProtocolarManifestacao = z.object({
  dataProtocolo: DataObrigatoria('Informe a data do protocolo (dd/mm/aaaa)').refine(naoFutura, 'A data do protocolo não pode ser no futuro'),
})
export type ProtocolarManifestacao = z.input<typeof ProtocolarManifestacao>

/** POST /api/casos/:id/manifestacao/dilacao (CA12): a Sênior autoriza o pedido de dilação, com o motivo. */
export const AutorizarDilacao = z.object({ motivo: z.string({ error: 'Escreva o motivo da dilação' }).trim().min(1, 'Escreva o motivo da dilação') })

/**
 * POST /api/casos/:id/manifestacao/sem-prova (ajuste do Mateus, 06/10): o documento não existe ou a perícia não tem como
 * ser feita. A advogada encerra o item, ou a perícia, com o motivo obrigatório; o motivo é a prova em texto do item
 * (GGVP-68 CA2), e o portão continua: só manifesta com todos os itens provados, por documento ou por justificativa (G21).
 */
export const EncerrarSemProva = z.object({
  alvo: z.enum(['item', 'pericia'], { error: 'Escolha o item ou a perícia' }),
  id: z.uuid({ error: 'Escolha o item ou a perícia' }),
  motivo: z.string({ error: 'Escreva por que vai manifestar sem essa prova' }).trim().min(1, 'Escreva por que vai manifestar sem essa prova'),
})
export type EncerrarSemProva = z.infer<typeof EncerrarSemProva>

/** POST /api/casos/:id/manifestacao/indisponibilidade (CA13): a data em que o sistema do tribunal voltou; a prova vai junto. */
export const RegistrarIndisponibilidade = z.object({ voltouEm: DataObrigatoria('Informe a data em que o sistema do tribunal voltou (dd/mm/aaaa)') })
export type RegistrarIndisponibilidade = z.input<typeof RegistrarIndisponibilidade>

// Grupo 3 (GGVP-52 a 71): do indeferido ao protocolo da petição inicial.

/** Setores do despacho da Sênior (GGVP-54 CA2): o Jurídico administrativo entra só pela perícia (CA5). */
export const SETORES_DO_DESPACHO = ['atendimento', 'documentacao'] as const

/** CA6: o que o setor deve obter e "Essa tarefa tem prazo?": com "Sim", a data de entrega; com "Não", sem prazo. */
const ItemDoDespacho = z
  .object({
    setor: z.enum(SETORES_DO_DESPACHO, { error: 'Escolha o setor de cada pedido' }),
    descricao: z.string({ error: 'Escreva o que o setor deve obter' }).trim().min(1, 'Escreva o que o setor deve obter'),
    temPrazo: z.boolean({ error: 'Responda "Essa tarefa tem prazo?"' }),
    prazo: z.string().optional(),
  })
  .refine((i) => !i.temPrazo || validarData(i.prazo ?? ''), { message: 'Informe a data de entrega (dd/mm/aaaa)', path: ['prazo'] })
  .transform((i) => ({ setor: i.setor, descricao: i.descricao, prazo: i.temPrazo ? (dataParaIso(i.prazo) as string) : null }))

/** Épico IA (GGVP-54 CA4): o despacho que partiu da análise da IA guarda a chamada à parte do que a Sênior decidiu. */
const ChamadaIaOpcional = z.uuid().optional()

/** POST /api/casos/:id/despacho (GGVP-54 CA2, CA3, CA5, CA6; G4): "nada falta", ou os setores acionados e a perícia. */
export const Despachar = z.discriminatedUnion(
  'decisao',
  [
    z.object({ decisao: z.literal('nada_falta'), chamadaIaId: ChamadaIaOpcional }),
    z
      .object({
        decisao: z.literal('acionar'),
        itens: z.array(ItemDoDespacho).default([]),
        tiposPericia: z.array(z.enum(TIPOS_DE_PERICIA)).default([]),
        chamadaIaId: ChamadaIaOpcional,
      })
      .refine((d) => d.itens.length > 0 || d.tiposPericia.length > 0, { message: 'Marque ao menos um setor ou a perícia', path: ['itens'] })
      // CA2, CA6: cada setor recebe a própria tarefa, uma só (ajuste do Mateus, 06/10).
      .refine((d) => new Set(d.itens.map((i) => i.setor)).size === d.itens.length, { message: 'Cada setor recebe um pedido só', path: ['itens'] }),
  ],
  { error: 'Escolha "Nada falta" ou o que falta' },
)
export type Despachar = z.input<typeof Despachar>

/** Épico IA (GGVP-54 CA1): o que a IA devolve, em JSON. "nada falta" sem itens; senão, o que cada setor deve obter. */
export const AnaliseDoIndeferimentoPelaIa = z.object({
  analise: z.string().trim().min(1),
  nadaFalta: z.boolean(),
  itens: z.array(z.object({ setor: z.enum(SETORES_DO_DESPACHO), descricao: z.string().trim().min(1) })).default([]),
  pericias: z.array(z.enum(TIPOS_DE_PERICIA)).default([]),
})
export type AnaliseDoIndeferimentoPelaIa = z.infer<typeof AnaliseDoIndeferimentoPelaIa>

/** POST /api/casos/:id/despacho/analise. Sem sugestão (sem chave, falha, fora do formato): `leitura` nula e o motivo. */
export const AnaliseDoDespacho = z.object({
  sugestao: SugestaoDaIa.nullable(),
  leitura: AnaliseDoIndeferimentoPelaIa.nullable(),
  motivo: z.string().nullable(),
  /** GGVP-45 CA2: o acervo não tinha nada parecido. */
  aviso: z.string().nullable(),
})
export type AnaliseDoDespacho = z.infer<typeof AnaliseDoDespacho>

/** GET /api/casos/:id/despacho (GGVP-54 CA1, CA9; GGVP-58 CA3, CA11): o histórico do caso, o despacho e o status dos setores. */
export const Despacho = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  indeferimento: z.object({
    dataDecisao: z.string(),
    motivoInss: z.string().nullable(),
    carta: z.object({ id: z.uuid(), nome: z.string() }).nullable(),
    motivoEscrito: z.object({ texto: z.string(), por: z.string(), em: z.string() }).nullable(),
  }),
  despacho: z.object({ decisao: z.enum(['nada_falta', 'acionar']), por: z.string(), em: z.string() }).nullable(),
  setores: z.array(
    z.object({
      id: z.uuid(),
      setor: z.enum(SETORES_DO_DESPACHO),
      descricao: z.string(),
      prazo: z.string().nullable(),
      situacao: z.enum(['pendente', 'cumprido', 'nao_cumprido']),
      escalada: z.boolean(),
      /** GGVP-68 CA14: quando o setor foi acionado e o laço (tentativas e decisões da Sênior), do mais antigo ao mais novo. */
      acionadoEm: z.string().nullable(),
      historicoDoLaco: z.array(TentativaDoLaco),
      /** GGVP-94 CA9: a Sênior decide o item que passou do limite. */
      podeDecidir: z.boolean(),
    }),
  ),
  pericias: z.array(z.object({ tipo: z.enum(TIPOS_DE_PERICIA), resultado: z.string().nullable() })),
  /** Quem ainda não subiu o card (GGVP-58 CA3). */
  faltam: z.array(z.string()),
  podeDespachar: z.boolean(),
  podeEncerrar: z.boolean(),
})
export type Despacho = z.infer<typeof Despacho>

/** GGVP-63 CA6, CA9: as opções do pedido. O indeferimento do INSS (Tema 350) entra sempre, sem opção. */
export const OpcoesDoPedido = z.object({
  tutelaUrgencia: z.boolean().default(false),
  precedentes: z.boolean().default(false),
  anexarCitados: z.boolean().default(true),
})
export type OpcoesDoPedido = z.infer<typeof OpcoesDoPedido>

/** Um documento citado, na ordem do pedido: um documento do caso ou o nome do que ainda falta (GGVP-71 CA7, CA13). */
const Citado = z
  .object({ documentoId: z.uuid({ error: 'Documento citado inválido' }).nullable().default(null), nome: z.string().trim().default('') })
  .refine((c) => c.documentoId !== null || c.nome !== '', { message: 'Escreva o nome do documento que falta', path: ['nome'] })

/** POST /api/casos/:id/peticao/pedido (GGVP-63 CA1, CA6, CA9, CA10): sem IA, a advogada escreve ou cola a versão 1. */
export const PedirPeticao = z.object({
  instrucoes: z.string().trim().default(''),
  opcoes: OpcoesDoPedido.default({ tutelaUrgencia: false, precedentes: false, anexarCitados: true }),
  citados: z.array(Citado).default([]),
  texto: z.string({ error: 'Escreva ou cole o texto da petição (versão 1)' }).trim().min(1, 'Escreva ou cole o texto da petição (versão 1)'),
  /** Épico IA: a versão 1 partiu da minuta da IA (a chamada fica no histórico e a versão, marcada). */
  chamadaIaId: z.uuid().optional(),
})
export type PedirPeticao = z.input<typeof PedirPeticao>

/** POST /api/casos/:id/peticao/minuta (épico IA): o que a advogada já escolheu; a IA escreve a versão 1, sem gravar nada. */
export const PedirMinuta = PedirPeticao.pick({ instrucoes: true, opcoes: true, citados: true }).extend({
  /** Sugestão pronta (07/10): "Escrever de novo com a IA" pede outra minuta mesmo com o mesmo pedido. */
  refazer: z.boolean().optional(),
})
export type PedirMinuta = z.input<typeof PedirMinuta>
/** A minuta como sugestão (com as fontes), ou nula com o motivo; `aviso`: "sem referência na casa" (GGVP-45 CA2). */
export const MinutaDaIa = z.object({ sugestao: SugestaoDaIa.nullable(), motivo: z.string().nullable(), aviso: z.string().nullable() })
export type MinutaDaIa = z.infer<typeof MinutaDaIa>

/** GET /api/casos/:id/peticao (GGVP-63; a conferência e o protocolo entram com a GGVP-67 e a GGVP-71). */
export const PeticaoInicial = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  /** CA1: quem ainda não subiu o card no despacho da Sênior (setores e perícia). */
  faltam: z.array(z.string()),
  /** A carta de indeferimento, que entra sempre (Tema 350). */
  carta: z.object({ id: z.uuid(), nome: z.string() }).nullable(),
  /** Os documentos do caso, para citar (CA6). */
  documentos: z.array(z.object({ id: z.uuid(), nome: z.string() })),
  pedido: z
    .object({
      por: z.string(),
      em: z.string(),
      instrucoes: z.string(),
      opcoes: OpcoesDoPedido,
      /** GGVP-71 CA13: o que falta pode ter sido pedido à Documentação. */
      citados: z.array(z.object({ documentoId: z.uuid().nullable(), nome: z.string(), pedidoADocumentacao: z.boolean() })),
    })
    .nullable(),
  versoes: z.array(
    z.object({
      numero: z.number(),
      por: z.string(),
      em: z.string(),
      oQueMudou: z.string().nullable(),
      hash: z.string(),
      aprovadaPor: z.string().nullable(),
      aprovadaEm: z.string().nullable(),
    }),
  ),
  /** A versão atual, inteira, e o que mudou desde a anterior, por parágrafo (GGVP-67 CA3, CA4); na versão 1, nada a comparar. */
  atual: z
    .object({
      numero: z.number(),
      texto: z.string(),
      diferenca: z.array(z.object({ tipo: z.enum(['igual', 'incluido', 'removido']), texto: z.string() })).nullable(),
    })
    .nullable(),
  podePedir: z.boolean(),
  /** GGVP-67: só a advogada confere, com "Conferir petição" aberta; a aprovada não se edita, mexer gera outra versão (CA7). */
  podeEditar: z.boolean(),
  podeAprovar: z.boolean(),
  /** GGVP-71 CA1, CA8, CA11: o pacote da versão aprovada, na ordem, para baixar; nulo enquanto não foi gerado. */
  pacote: z.array(z.object({ documentoId: z.uuid(), nome: z.string(), papel: z.enum(['peticao', 'carta', 'citado']) })).nullable(),
  /** GGVP-71 CA2, CA6, CA7 (G7): as três travas, com o critério, o status e a evidência; vazias antes da aprovação. */
  travas: z.array(z.object({ chave: z.enum(['tema350', 'cpf', 'pacote']), nome: z.string(), criterio: z.string(), ok: z.boolean(), evidencia: z.string() })),
  /** GGVP-71 CA11 (Q8): os tribunais da configuração do escritório, com o site de peticionamento e o tamanho por arquivo. */
  tribunais: z.array(z.object({ nome: z.string(), site: z.string(), tamanhoMaximoMb: z.number() })),
  /** GGVP-71 CA4, CA10: o protocolo registrado. */
  protocolo: z.object({ em: z.string(), numero: z.string(), tribunal: z.string(), por: z.string(), versao: z.number() }).nullable(),
  podeProtocolar: z.boolean(),
})
export type PeticaoInicial = z.infer<typeof PeticaoInicial>

/** POST /api/casos/:id/peticao/versoes (GGVP-67 CA1, CA5, CA7, CA10): "Editar eu mesma" grava a versão seguinte, com o que mudou. */
export const NovaVersao = z.object({
  texto: z.string({ error: 'Escreva o texto da nova versão' }).trim().min(1, 'Escreva o texto da nova versão'),
  oQueMudou: z.string({ error: 'Escreva o que mudou nesta versão' }).trim().min(1, 'Escreva o que mudou nesta versão'),
  /** Épico IA (GGVP-67 CA1): a versão partiu da sugestão da IA; sai marcada "versão da IA". */
  chamadaIaId: z.uuid().optional(),
})
export type NovaVersao = z.infer<typeof NovaVersao>

/** POST /api/casos/:id/peticao/versoes/sugestao (GGVP-67 CA1, CA5): "Não está boa", com o que mudar. Responde `MinutaDaIa`. */
export const PedirOutraVersao = z.object({
  oQueMudar: z.string({ error: 'Escreva o que mudar' }).trim().min(1, 'Escreva o que mudar'),
})
export type PedirOutraVersao = z.infer<typeof PedirOutraVersao>

/** POST /api/casos/:id/peticao/versoes/:n/aprovacao (GGVP-67 CA2, CA5, CA9; G6, G18): "Aprovar" só com as três marcações. */
export const AprovarPeticao = z.object({
  liNaIntegra: z.literal(true, { error: 'Marque "Li a petição na íntegra"' }),
  conferem: z.literal(true, { error: 'Marque "Fundamentos, pedidos e valores conferem com o caso"' }),
  nadaContradiz: z.literal(true, { error: 'Marque "Nada contradiz o requisito do benefício (G18)"' }),
})
export type AprovarPeticao = z.infer<typeof AprovarPeticao>

/**
 * POST /api/casos/:id/peticao/protocolo (GGVP-71 CA3, CA5, CA6, CA11; G7), com o comprovante no mesmo envio: o tribunal
 * da configuração, o número do processo (CNJ), a data e a confirmação de cada trava pela evidência.
 */
export const ProtocolarPeticao = z.object({
  tribunal: z.string({ error: 'Escolha o tribunal' }).trim().min(1, 'Escolha o tribunal'),
  numeroCnj: z
    .string({ error: 'Informe o número do processo (CNJ)' })
    .refine(validarCnj, 'Número do processo inválido. Confira os 20 dígitos do CNJ.')
    .transform((v) => normalizarCnj(v)),
  dataProtocolo: DataObrigatoria('Informe a data do protocolo (dd/mm/aaaa)').refine(naoFutura, 'A data do protocolo não pode ser no futuro'),
  conferiTema350: z.literal(true, { error: 'Confirme a trava Tema 350 pela evidência' }),
  conferiCpf: z.literal(true, { error: 'Confirme a trava do CPF pela evidência' }),
  conferiPacote: z.literal(true, { error: 'Confirme a trava do pacote pela evidência' }),
})
export type ProtocolarPeticao = z.input<typeof ProtocolarPeticao>

