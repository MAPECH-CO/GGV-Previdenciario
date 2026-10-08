// A documentação médica do servidor para as Centrais e o portão das telas ainda não ligadas (GGVP-132): as tarefas do
// parecer e do complemento dos casos do banco, o parecer de cada um para o G17 e as fichas, para a cópia da tela. Sem
// conteúdo clínico: só o resultado e o que fazer. ponytail: monta caso a caso; um resumo no banco quando crescer.
import { eq, isNotNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { decisao, documentacaoMedica, documento, documentoMedico } from '../banco/esquema.ts'
import { criarCasoMedico } from '../fluxo/documentacao-medica.ts'
import { exigir } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import type { Ficha, Tarefa } from '../../../web/src/dados/tipos.ts'
import { tarefasDoComplemento } from '../../../web/src/regras/complemento.ts'
import type { Parecer } from '../../../web/src/regras/liberacao.ts'
import { parecerDoPortao, tarefasDoCaso } from '../../../web/src/regras/parecerDoCaso.ts'
import { criarComplementoDoCaso } from './complemento.ts'
import { criarParecerDoCaso } from './parecer.ts'

type Opcoes = { banco: Banco; agora?: () => Date }

export type DocumentacaoMedicaDoServidor = { fichas: Ficha[]; tarefas: Tarefa[]; portoes: Record<string, Parecer> }

export function registrarRotasDocumentacaoMedica(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const { acharCaso } = criarCasoMedico(banco, agora)
  const { emDia } = criarParecerDoCaso(banco, agora)
  const { montar } = criarComplementoDoCaso(banco, agora)

  /** Os casos com documentação médica: documento médico, parecer, complemento ou pedido de dispensa. */
  async function casosComDocumentacao(): Promise<string[]> {
    const ids = [
      ...(await banco.selectDistinct({ id: documento.casoId }).from(documentoMedico).innerJoin(documento, eq(documentoMedico.documentoId, documento.id)).where(isNotNull(documento.casoId))),
      ...(await banco.selectDistinct({ id: documentacaoMedica.casoId }).from(documentacaoMedica)),
      ...(await banco.selectDistinct({ id: decisao.casoId }).from(decisao).where(eq(decisao.tipo, 'dispensa_parecer'))),
    ].map((l) => l.id!)
    return [...new Set(ids)]
  }

  app.get('/api/documentacao-medica', { preHandler: exigir(banco, 'caso.ver', agora) }, async (): Promise<DocumentacaoMedicaDoServidor> => {
    const hoje = hojeEmBrasilia(agora())
    const fichas = new Map<string, Ficha>()
    const tarefas: Tarefa[] = []
    const portoes: Record<string, Parecer> = {}
    for (const id of await casosComDocumentacao()) {
      const c = await acharCaso(id)
      if (!c) continue
      fichas.set(c.ficha.id, c.ficha)
      const { p, laudoNovoEm } = await emDia(c)
      tarefas.push(...tarefasDoCaso({ ficha: c.ficha, processo: c.processo, p, ...(laudoNovoEm && { laudoNovoEm }), hoje }))
      const portao = parecerDoPortao(p)
      if (portao) portoes[id] = portao
      const complemento = await montar(c)
      if (complemento && complemento.tela.situacao !== 'encerrado') {
        const { pedir, decidir } = tarefasDoComplemento(complemento.tela, hoje)
        tarefas.push(pedir, ...(decidir ? [decidir] : []))
      }
    }
    return { fichas: [...fichas.values()], tarefas, portoes }
  })
}
