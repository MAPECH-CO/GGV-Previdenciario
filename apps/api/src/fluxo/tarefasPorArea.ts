// As tarefas abertas de cada área, por perfil, num lugar só: as tarefas do setor (GGVP-147) juntam todas. Cada área
// registra a sua fonte ao montar as rotas; a Central de cada pessoa continua lendo as rotas da área.
import type { Perfil } from '@ggv/contratos'
import type { Tarefa } from '../../../web/src/dados/tipos.ts'

export type FonteDeTarefas = (perfil: Perfil) => Promise<Tarefa[]>
export type TarefasPorArea = { registrar: (fonte: FonteDeTarefas) => void; doPerfil: (perfil: Perfil) => Promise<Tarefa[]> }

export function criarTarefasPorArea(): TarefasPorArea {
  const fontes: FonteDeTarefas[] = []
  return {
    registrar: (fonte) => void fontes.push(fonte),
    doPerfil: async (perfil) => (await Promise.all(fontes.map((f) => f(perfil)))).flat(),
  }
}
