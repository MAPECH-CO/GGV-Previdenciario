// Tarefas do setor (GGVP-147): o líder do Atendimento e a Sênior, líder do Jurídico, veem as tarefas abertas do setor e
// escolhem quem faz cada uma. Tela e servidor validam com o mesmo schema.
import { dataParaIso, validarData } from '@ggv/campos'
import { z } from 'zod'
import type { Perfil } from './permissoes.ts'

/** Os perfis de cada setor. A Documentação é função própria (GGVP-130) e não entra no setor do Atendimento. */
export const PERFIS_DO_SETOR = {
  atendimento: ['atendimento', 'atendimento_lider'],
  juridico: ['advogada', 'senior', 'juridico_adm'],
} as const satisfies Record<string, readonly Perfil[]>
export type Setor = keyof typeof PERFIS_DO_SETOR
export const ROTULO_DO_SETOR: Record<Setor, string> = { atendimento: 'Atendimento', juridico: 'Jurídico' }

export function setorDoPerfil(perfil: string | null | undefined): Setor | null {
  const achado = (Object.keys(PERFIS_DO_SETOR) as Setor[]).find((s) => (PERFIS_DO_SETOR[s] as readonly string[]).includes(perfil ?? ''))
  return achado ?? null
}

export const PRIORIDADES = ['normal', 'alta'] as const

/** Uma tarefa aberta do setor, com quem faz (nulo: sem responsável). Título e detalhe nunca levam CID nem diagnóstico. */
export const TarefaDoSetor = z.object({
  id: z.string(),
  codigo: z.string(),
  cliente: z.object({ id: z.string(), nome: z.string() }).nullable(),
  contexto: z.string().nullable(),
  acao: z.string(),
  detalhe: z.string(),
  /** Como a Central mostra: "hoje", "até 10/10". */
  prazo: z.string().nullable(),
  urgente: z.boolean(),
  href: z.string().nullable(),
  responsavel: z.object({ id: z.uuid(), nome: z.string() }).nullable(),
  prioridade: z.enum(PRIORIDADES).nullable(),
  recado: z.string().nullable(),
  /** Quem atribuiu, para o aviso na Central de quem recebe. */
  atribuidaPor: z.string().nullable(),
})
export type TarefaDoSetor = z.infer<typeof TarefaDoSetor>

/** Quem pode receber, com quantas tarefas abertas já tem (a barra "N hoje" do Figma 1600:1282). */
export const PessoaDoSetor = z.object({ id: z.uuid(), nome: z.string(), funcao: z.string(), carga: z.number().int() })
export type PessoaDoSetor = z.infer<typeof PessoaDoSetor>

/** GET /api/setor: o quadro do líder. */
export const QuadroDoSetor = z.object({ setor: z.enum(['atendimento', 'juridico']), pessoas: z.array(PessoaDoSetor), tarefas: z.array(TarefaDoSetor) })
export type QuadroDoSetor = z.infer<typeof QuadroDoSetor>

/** POST /api/setor/atribuicoes: quem faz, ou `null` para deixar sem responsável. Prazo em dd/mm/aaaa, opcional. */
export const AtribuirTarefa = z.object({
  tarefaId: z.string().trim().min(1, 'Escolha a tarefa'),
  responsavelId: z.uuid().nullable(),
  prazo: z
    .string()
    .refine((d) => d === '' || validarData(d), 'Informe o prazo (dd/mm/aaaa)')
    .transform((d) => (d === '' ? null : (dataParaIso(d) as string)))
    .optional(),
  prioridade: z.enum(PRIORIDADES).default('normal'),
  recado: z.string().trim().max(500, 'Recado com até 500 letras').optional(),
  avisar: z.boolean().default(true),
})
export type AtribuirTarefa = z.input<typeof AtribuirTarefa>

/** GET /api/setor/minhas: o que foi atribuído a quem está na sessão e o que foi para outra pessoa (sai da fila dela). */
export const MinhasDoSetor = z.object({ minhas: z.array(TarefaDoSetor), deOutros: z.array(z.string()) })
export type MinhasDoSetor = z.infer<typeof MinhasDoSetor>
