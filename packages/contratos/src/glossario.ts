// Glossário do escritório (GGVP-143): os termos que a transcrição e a IA escrevem como o escritório escreve.
// Fica na Configuração do escritório: a gestão vê; só a Sênior muda (`glossario.editar`). Toda mudança vai ao histórico.
import { normalizarNome } from '@ggv/campos'
import { z } from 'zod'

export const TIPOS_DE_TERMO = ['beneficio', 'sigla', 'perito', 'juizo', 'outro'] as const
export type TipoDeTermo = (typeof TIPOS_DE_TERMO)[number]
export const ROTULO_TIPO_DE_TERMO: Record<TipoDeTermo, string> = {
  beneficio: 'Benefício',
  sigla: 'Sigla',
  perito: 'Perito',
  juizo: 'Juízo ou vara',
  outro: 'Outro',
}

export const TermoDoGlossario = z.object({ id: z.uuid(), termo: z.string(), tipo: z.enum(TIPOS_DE_TERMO), significado: z.string().nullable() })
export type TermoDoGlossario = z.infer<typeof TermoDoGlossario>

/**
 * POST /api/configuracao/glossario e PUT /api/configuracao/glossario/:id. O termo é texto livre (sigla, "2ª Vara",
 * "BPC/LOAS"), por isso só `normalizarNome` dos `campos`, para os espaços; o tamanho fica aqui.
 */
export const SalvarTermo = z.object({
  termo: z
    .string({ error: 'Escreva o termo' })
    .transform(normalizarNome)
    .pipe(z.string().min(2, 'Escreva o termo').max(120, 'O termo vai até 120 caracteres')),
  tipo: z.enum(TIPOS_DE_TERMO, { error: 'Escolha o tipo do termo' }),
  significado: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? null : normalizarNome(s) || null))
    .pipe(z.string().max(300, 'O significado vai até 300 caracteres').nullable()),
})
export type SalvarTermo = z.input<typeof SalvarTermo>

/** GET /api/configuracao/glossario (`gestao.ver`; mudar com `glossario.editar`). */
export const GlossarioDoEscritorio = z.object({ termos: z.array(TermoDoGlossario), podeEditar: z.boolean() })
export type GlossarioDoEscritorio = z.infer<typeof GlossarioDoEscritorio>
