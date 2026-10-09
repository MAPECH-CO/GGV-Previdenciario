// Os modelos do kit (GGVP-136, CA1): uma seção da Configuração do escritório. A gestão vê; só a Sênior sobe ou troca
// (`modelo.subir`). O arquivo do Word é texto contratual do escritório: vai para o armazenamento privado, com versão, e a
// versão em vigor é a que o kit usa. Cada versão nova entra no histórico da configuração, na mesma transação.
import { createHash, randomUUID } from 'node:crypto'
import { ModelosDoEscritorio, TAMANHO_MAXIMO_DO_MODELO, TIPO_DO_DOCX, pode, type Erro } from '@ggv/contratos'
import { and, eq, max } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { modelo } from '../banco/esquema.ts'
import { lerModelo } from '../kit/docx.ts'
import { modelosEmVigor, type ArquivoDoModelo } from '../kit/modelos.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { MODELOS } from '../../../web/src/regras/contrato.ts'
import { ehVersaoRepetida, MSG_PUBLICADO_AGORA } from './configuracao.ts'
import { lerFormulario } from './formulario.ts'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export const MSG_ENVIE_O_MODELO = 'Envie o arquivo do modelo (.docx).'
export const MSG_MODELO_GRANDE = `O arquivo passa de ${TAMANHO_MAXIMO_DO_MODELO / 1024 / 1024} MB.`

export function registrarRotasModelos(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  app.get('/api/configuracao/modelos', { preHandler: exigir(banco, 'gestao.ver', agora) }, async (pedido) => {
    const vigentes = await modelosEmVigor(banco)
    return ModelosDoEscritorio.parse({
      modelos: MODELOS.map(({ id, nome }) => {
        const v = vigentes.find((m) => m.nome === id)
        return { id, nome, versao: v?.versao ?? null, vigenteDesde: v?.desde.toISOString() ?? null }
      }),
      podeSubir: pode(pedido.perfilAtivo, 'modelo.subir'),
    })
  })

  // CA1: o arquivo é conferido antes de guardar (é do Word, as variáveis são as que o portal sabe preencher, sem CPF
  // escrito). Publicar revoga a versão em vigor e grava a seguinte; o kit já gerado fica com o modelo da época.
  app.put<{ Params: { id: string } }>('/api/configuracao/modelos/:id', { preHandler: exigir(banco, 'modelo.subir', agora) }, async (pedido, resposta) => {
    const m = MODELOS.find((x) => x.id === pedido.params.id)
    if (!m) return negar(resposta, 404, 'Modelo fora da lista do kit.')
    const formulario = await lerFormulario(pedido)
    if (!formulario?.arquivo || formulario.arquivo.conteudo.length === 0) return negar(resposta, 400, MSG_ENVIE_O_MODELO)
    const { conteudo } = formulario.arquivo
    if (conteudo.length > TAMANHO_MAXIMO_DO_MODELO) return negar(resposta, 400, MSG_MODELO_GRANDE)
    const lido = lerModelo(conteudo)
    if (!lido.ok) return negar(resposta, 400, lido.erro)

    // O nome do arquivo enviado não é guardado: pode trazer nome de cliente. A chave é do portal.
    const arquivo: ArquivoDoModelo = { chave: `modelos/${m.id}/${randomUUID()}.docx`, sha256: createHash('sha256').update(conteudo).digest('hex'), tamanho: conteudo.length }
    await armazenamento.salvar(arquivo.chave, conteudo, TIPO_DO_DOCX)
    const quem = pedido.usuario!.id
    try {
      // A versão é lida, gravada e registrada no histórico na mesma transação; a unicidade recusa a segunda publicação.
      const versao = await banco.transaction(async (tx) => {
        const [{ ultima }] = await tx.select({ ultima: max(modelo.versao) }).from(modelo).where(and(eq(modelo.tipo, 'contrato'), eq(modelo.nome, m.id)))
        const versao = (ultima ?? 0) + 1
        await tx.update(modelo).set({ ativo: false }).where(and(eq(modelo.tipo, 'contrato'), eq(modelo.nome, m.id), eq(modelo.ativo, true)))
        await tx.insert(modelo).values({ tipo: 'contrato', nome: m.id, versao, conteudo: JSON.stringify(arquivo), ativo: true, criadoEm: agora() })
        await registrarHistorico(tx, agora)(quem, 'modelo_publicado', pedido, 'configuracao', { nome: m.nome, versao })
        return versao
      })
      return resposta.code(201).send({ ok: true, versao })
    } catch (e) {
      if (ehVersaoRepetida(e)) return negar(resposta, 409, MSG_PUBLICADO_AGORA)
      throw e
    }
  })
}
