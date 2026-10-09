// Clientes e Processos (GGVP-78, Figma 1927:605 e 1927:888): as duas bases do topo, com busca, filtros e página.
// Só o que todos do caso veem: sem valores, sem conteúdo médico, CPF mascarado.
import { z } from 'zod'

/** A coluna "Situação / êxito" de Clientes: Êxito = ganho, ganho parcial ou acordo; Perdido = improcedente ou extinto. */
export const SITUACOES_DO_CLIENTE = ['em_andamento', 'administrativo', 'exito', 'perdido', 'lead'] as const
export type SituacaoDoCliente = (typeof SITUACOES_DO_CLIENTE)[number]
export const ROTULO_SITUACAO_DO_CLIENTE: Record<SituacaoDoCliente, string> = {
  em_andamento: 'Em andamento',
  administrativo: 'Administrativo',
  exito: 'Êxito',
  perdido: 'Perdido',
  lead: 'Lead',
}

/** O desfecho do processo como o Raio-X lê: Êxito (ganho, ganho parcial), Acordo, Perdido no mérito, Extinto sem mérito. */
export const DESFECHOS_DA_LISTA = ['em_andamento', 'exito', 'acordo', 'perdido', 'extinto'] as const
export type DesfechoDaLista = (typeof DESFECHOS_DA_LISTA)[number]
export const ROTULO_DESFECHO_DA_LISTA: Record<DesfechoDaLista, string> = {
  em_andamento: 'Em andamento',
  exito: 'Êxito',
  acordo: 'Acordo',
  perdido: 'Perdido',
  extinto: 'Extinto',
}

export const FASES_DA_LISTA = ['atendimento', 'administrativa', 'judicial', 'encerrado'] as const
export const ROTULO_FASE_DA_LISTA: Record<(typeof FASES_DA_LISTA)[number], string> = {
  atendimento: 'Atendimento',
  administrativa: 'Administrativa',
  judicial: 'Judicial',
  encerrado: 'Encerrado',
}

export const POR_PAGINA = 50

/** Filtro de texto escolhido numa lista que o próprio servidor manda (benefício, cidade, foro, juiz, perito). */
const opcao = z.string().trim().max(200).optional()
const comum = {
  /** Nome, CPF, telefone ou número. Com o termo, a tela usa o POST: CPF não vai no endereço. */
  busca: z.string().trim().max(100).optional(),
  beneficio: opcao,
  pagina: z.coerce.number().int().min(1).default(1),
  /** "Exportar CSV": todas as linhas do filtro, sem página. */
  tudo: z.enum(['1']).optional(),
}

/** GET /api/clientes (filtros na consulta) e POST /api/clientes/busca (com o termo, no corpo). */
export const FiltrosDeClientes = z.object({
  ...comum,
  cidade: opcao,
  exito: z.enum(SITUACOES_DO_CLIENTE).optional(),
  /** Ativos, Clientes e Leads deixam de fora o lead arquivado; Todos traz também ele. */
  situacao: z.enum(['ativos', 'clientes', 'leads', 'todos']).default('ativos'),
  ordem: z.enum(['contato', 'nome']).default('contato'),
})
export type FiltrosDeClientes = z.infer<typeof FiltrosDeClientes>

export const ListaDeClientes = z.object({
  clientes: z.array(
    z.object({
      id: z.uuid(),
      nome: z.string(),
      /** "***.482.113-**". */
      cpf: z.string().nullable(),
      beneficio: z.string().nullable(),
      cidade: z.string().nullable(),
      processos: z.number().int(),
      situacao: z.enum(SITUACOES_DO_CLIENTE),
      /** aaaa-mm-dd */
      ultimoContato: z.string().nullable(),
    }),
  ),
  /** Do filtro inteiro, não só da página: clientes e leads; `leads`, quantos destes são lead. */
  total: z.number().int(),
  leads: z.number().int(),
  pagina: z.number().int(),
  paginas: z.number().int(),
  opcoes: z.object({ beneficios: z.array(z.string()), cidades: z.array(z.string()) }),
})
export type ListaDeClientes = z.infer<typeof ListaDeClientes>

/** GET /api/processos e POST /api/processos/busca. `cliente`: os processos de um cliente (a contagem em Clientes). */
export const FiltrosDeProcessos = z.object({
  ...comum,
  cliente: z.uuid().optional(),
  foro: opcao,
  juiz: opcao,
  perito: opcao,
  exito: z.enum(DESFECHOS_DA_LISTA).optional(),
  fase: z.enum(FASES_DA_LISTA).optional(),
  ordem: z.enum(['ajuizamento', 'autor']).default('ajuizamento'),
})
export type FiltrosDeProcessos = z.infer<typeof FiltrosDeProcessos>

export const ListaDeProcessos = z.object({
  processos: z.array(
    z.object({
      /** O caso: a linha abre /casos/:id. */
      id: z.uuid(),
      /** CNJ, NB ou protocolo, formatado; nulo antes de existir. */
      numero: z.string().nullable(),
      clienteId: z.uuid(),
      autor: z.string(),
      beneficio: z.string().nullable(),
      fase: z.enum(FASES_DA_LISTA),
      foro: z.string().nullable(),
      juiz: z.string().nullable(),
      perito: z.string().nullable(),
      desfecho: z.enum(DESFECHOS_DA_LISTA),
      /** aaaa-mm-dd do protocolo da petição inicial. */
      ajuizadoEm: z.string().nullable(),
    }),
  ),
  total: z.number().int(),
  /** Quantos do filtro estão no acervo lido (o Raio-X). */
  doAcervo: z.number().int(),
  pagina: z.number().int(),
  paginas: z.number().int(),
  opcoes: z.object({ beneficios: z.array(z.string()), foros: z.array(z.string()), juizes: z.array(z.string()), peritos: z.array(z.string()) }),
})
export type ListaDeProcessos = z.infer<typeof ListaDeProcessos>
