// EXEMPLO. Servidor de exemplo das transcrições do caso (GGVP-46), sobre o mesmo banco de servidor.ts. A transcrição em
// si (e o "tentar de novo") é `transcrever`, em entrevista.ts. Nada aqui apaga áudio nem texto (CA5). Ligar no servidor:
// trocar o corpo de cada função por fetch no endpoint da design.md (change ggvp-6).
import { formatarTelefone } from '../campos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { relogio } from '../regras/entrevista.ts'
import { QUEM_ADVOGADA, agora, esperar, evento, gravacaoDoServidor, gravar, ler, noBanco, receber, type Banco } from './servidor.ts'
import type { Ficha, Gravacao, TarefaEncaminhada } from './tipos.ts'

/** GGVP-125, bloco 3a: a transcrição das fichas do servidor muda lá; a cópia daqui recebe a gravação, a ficha e as tarefas. */
async function noServidor(caminho: string, corpo: object, method = 'POST') {
  const r = await noBanco<{ gravacao: Gravacao; ficha: Ficha; tarefas?: TarefaEncaminhada[] }>(caminho, { method, corpo })
  return { gravacao: r.gravacao, ficha: receber(r)! }
}

function acharGravacao(banco: Banco, gravacaoId: string): { gravacao: Gravacao; ficha: Ficha } {
  const gravacao = banco.gravacoes.find((g) => g.id === gravacaoId)
  const ficha = banco.fichas.find((f) => f.id === gravacao?.fichaId)
  if (!gravacao || !ficha) throw new Error('Gravação não encontrada')
  return { gravacao, ficha }
}

/** GET /api/fichas/:id/gravacoes. Da mais nova para a mais antiga (CA4). */
export async function obterGravacoes(fichaId: string): Promise<Gravacao[]> {
  return ler()
    .gravacoes.filter((g) => g.fichaId === fichaId)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id))
}

/**
 * POST /api/gravacoes/:id/conferencias. Só o que a advogada conferiu sai da transcrição (CA6, G14): o da ficha muda a
 * ficha, com o valor antigo no histórico; o da Documentação vira "Pedir documento"; cofre e processo ficam marcados.
 */
export async function conferirInformacoes(gravacaoId: string, ids: string[]): Promise<{ gravacao: Gravacao; ficha: Ficha }> {
  await esperar()
  if (ids.length === 0) throw new Error('Marque o que você conferiu.')
  if (gravacaoDoServidor(gravacaoId)) return noServidor(`/gravacoes/${gravacaoId}/conferencias`, { ids })
  const banco = ler()
  const { gravacao: g, ficha } = acharGravacao(banco, gravacaoId)
  const hoje = hojeIso(agora())
  const quando = agora().toISOString()
  const deQuando = `da entrevista de ${dataCurta(g.data, hoje)}`
  for (const info of g.extraidas.filter((e) => ids.includes(e.id) && !e.conferidaEm)) {
    info.conferidaEm = quando
    if (info.destino === 'ficha' && info.campo) {
      const falado = (v: string) => (info.campo === 'telefone' && v ? formatarTelefone(v) : v)
      const antes = ficha[info.campo] ?? ''
      ficha[info.campo] = info.valor
      ficha.historico.push(evento(`Levou à ficha, ${deQuando}, ${info.rotulo.toLowerCase()}: «${falado(antes) || '—'}» → «${falado(info.valor)}»`, QUEM_ADVOGADA))
      if (!g.marcas.includes('ficha atualizada')) g.marcas.push('ficha atualizada')
    }
    if (info.destino === 'documentacao') {
      banco.seq += 1
      const tarefa: TarefaEncaminhada = {
        id: `pedir-${banco.seq}`,
        codigo: 'D1.23',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Pedir documento',
        detalhe: `${info.valor} · citado ${deQuando}`,
        prazo: 'esta semana',
        href: `/clientes/${ficha.id}`,
        setor: 'Documentação · ADM',
      }
      banco.tarefas.push(tarefa)
      ficha.historico.push(evento(`Pediu à Documentação, ${deQuando}: ${info.valor}`, QUEM_ADVOGADA))
    }
  }
  gravar(banco)
  return { gravacao: g, ficha }
}

/** POST /api/gravacoes/:id/documentos. A lista conferida vai para o checklist do benefício, GGVP-91 (CA7). */
export async function conferirDocumentos(gravacaoId: string, documentos: string[]): Promise<Gravacao> {
  await esperar()
  const lista = documentos.map((d) => d.trim()).filter(Boolean)
  if (lista.length === 0 || lista.some((d) => d.length < 2 || d.length > 120)) throw new Error('Lista de documentos inválida')
  if (gravacaoDoServidor(gravacaoId)) return (await noServidor(`/gravacoes/${gravacaoId}/documentos`, { documentos: lista })).gravacao
  const banco = ler()
  const { gravacao: g, ficha } = acharGravacao(banco, gravacaoId)
  g.documentos = lista
  g.documentosConferidosEm = agora().toISOString()
  ficha.checklist = [...new Set([...(ficha.checklist ?? []), ...lista])]
  ficha.historico.push(evento(`Conferiu os documentos da entrevista e mandou ao checklist do benefício: ${lista.join(', ')}`, QUEM_ADVOGADA))
  gravar(banco)
  return g
}

/** PATCH /api/gravacoes/:id/trechos/:aos. Marca ou desmarca um trecho como prova (CA6). */
export async function marcarProva(gravacaoId: string, aos: number, prova: boolean): Promise<Gravacao> {
  if (gravacaoDoServidor(gravacaoId)) return (await noServidor(`/gravacoes/${gravacaoId}/trechos/${aos}`, { prova }, 'PATCH')).gravacao
  await esperar()
  const banco = ler()
  const { gravacao: g, ficha } = acharGravacao(banco, gravacaoId)
  const trecho = g.trechos.find((t) => t.aos === aos)
  if (!trecho) throw new Error('Trecho não encontrado')
  trecho.prova = prova || undefined
  ficha.historico.push(evento(`${prova ? 'Marcou' : 'Desmarcou'} como prova o trecho de ${relogio(aos).slice(3)} (${g.titulo.toLowerCase()})`, QUEM_ADVOGADA))
  gravar(banco)
  return g
}
