// Modelos do kit (GGVP-136): os arquivos do Word do escritório, com versão. Ficam na Configuração do escritório: a gestão vê;
// só a Sênior sobe ou troca (`modelo.subir`). O arquivo é texto contratual do escritório e vai para o armazenamento privado.
import { z } from 'zod'

/** O .docx do modelo vai até 10 MB: os do escritório têm de 1 a 2 MB, com as imagens do papel timbrado. */
export const TAMANHO_MAXIMO_DO_MODELO = 10 * 1024 * 1024

export const TIPO_DO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Um modelo da lista: `versao` e `vigenteDesde` são nulos até a Sênior subir o primeiro arquivo (o kit avisa que falta).
 * `percentualHonorarios` é o do modelo, que a Sênior informa (GGVP-158, P3.3); nulo até ela informar.
 */
export const ModeloDoKit = z.object({
  id: z.string(),
  nome: z.string(),
  versao: z.number().nullable(),
  vigenteDesde: z.string().nullable(),
  percentualHonorarios: z.number().nullable(),
})
export type ModeloDoKit = z.infer<typeof ModeloDoKit>

const MSG_PERCENTUAL = 'Informe o percentual de honorários, de 0 a 100.'
/** PUT /api/configuracao/modelos/:id/honorarios (`modelo.subir`): o percentual de honorários do modelo (GGVP-158, P3.3). */
export const PercentualDoModelo = z.object({ percentual: z.number({ error: MSG_PERCENTUAL }).min(0, MSG_PERCENTUAL).max(100, MSG_PERCENTUAL) })
export type PercentualDoModelo = z.infer<typeof PercentualDoModelo>

/** GET /api/configuracao/modelos (`gestao.ver`; subir com `modelo.subir`, em PUT /api/configuracao/modelos/:id). */
export const ModelosDoEscritorio = z.object({ modelos: z.array(ModeloDoKit), podeSubir: z.boolean() })
export type ModelosDoEscritorio = z.infer<typeof ModelosDoEscritorio>
