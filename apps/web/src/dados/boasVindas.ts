// EXEMPLO. Servidor de exemplo das boas-vindas (GGVP-97), sobre o mesmo banco de servidor.ts. O Chatwoot é simulado: a
// mensagem "sai" quando a ficha tem telefone; sem telefone, o Chatwoot não acha a conversa e o envio falha (CA6). Ligar
// no servidor: trocar o corpo de cada função por fetch no endpoint da spec da ggvp-97 e mandar pelo Chatwoot (GGVP-102).
import { boasVindasDoCaso, type BoasVindas, type RegistroDasBoasVindas } from '../regras/boasVindas.ts'
import { hojeIso } from '../regras/datas.ts'
import { checklistDoCaso, contratoAssinado } from './checklist.ts'
import { doBancoOuNulo } from './parecer.ts'
import { agora, doServidor, esperar, evento, gravar, ler, noBanco, receber, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

export type { BoasVindas, RegistroDasBoasVindas } from '../regras/boasVindas.ts'

/** "Enviar pelo Chatwoot": só depois de alguém conferir a mensagem (CA4). */
export type EnvioDasBoasVindas = { conferi: true; mensagem: string }

/** As cópias que vão junto, quando o contrato do caso está assinado (GGVP-89). */
export function copiasDoKit(banco: Banco, processo: Processo): string[] {
  return contratoAssinado(banco, processo) ? ['contrato', 'procuração'] : []
}

function montar(banco: Banco, processoId: string): (BoasVindas & { fichaId: string; nome: string }) | null {
  const caso = checklistDoCaso(banco, processoId)
  if (!caso) return null
  const { ficha, processo, beneficio, checklist, conferencia } = caso
  const registros = [...(banco.boasVindas ?? []), ...(banco.boasVindasDoServidor ?? [])].filter((r) => r.fichaId === ficha.id)
  const copias = copiasDoKit(banco, processo)
  return {
    fichaId: ficha.id,
    nome: ficha.nome,
    ...boasVindasDoCaso({ ficha, processoId, beneficio, copias, faltam: checklist.faltam, conferido: Boolean(conferencia), registros }),
  }
}

/** GET /api/processos/:id/boas-vindas */
export async function obterBoasVindas(processoId: string): Promise<BoasVindas | null> {
  if (doServidor(processoId)) return doBancoOuNulo<BoasVindas>(`/processos/${processoId}/boas-vindas`)
  const banco = ler()
  const boasVindas = montar(banco, processoId)
  gravar(banco)
  return boasVindas
}

/** POST /api/processos/:id/boas-vindas. Uma vez, conferida, pelo Chatwoot; a falha fica no histórico e vira tarefa (CA4, CA6). */
export async function enviarBoasVindas(processoId: string, envio: EnvioDasBoasVindas): Promise<RegistroDasBoasVindas> {
  if (doServidor(processoId)) {
    // Bloco 5c (decisão do Mateus, 09/10): o portal ainda não manda; "Já enviei" marca as que a Atendimento mandou por fora.
    const r = await noBanco<{ boasVindas: BoasVindas; ficha: Ficha }>(`/processos/${processoId}/boas-vindas`, { method: 'POST' })
    receber({ ficha: r.ficha, boasVindas: [r.boasVindas.registro!] })
    return r.boasVindas.registro!
  }
  await esperar()
  if (envio.conferi !== true) throw new Error('Confira a mensagem antes de enviar')
  const mensagem = envio.mensagem?.trim() ?? ''
  if (mensagem.length === 0 || mensagem.length > 2000) throw new Error('Mensagem vazia ou longa demais')
  const banco = ler()
  const atual = montar(banco, processoId)
  if (!atual) throw new Error('Caso não encontrado')
  if (atual.situacao === 'enviada') throw new Error('As boas-vindas já foram enviadas')
  if (atual.situacao === 'ja-era-cliente') throw new Error('Já era cliente: as boas-vindas não vão')
  if (atual.situacao === 'aguardando-checklist') throw new Error('Confira o checklist antes das boas-vindas')
  const ficha = banco.fichas.find((f) => f.id === atual.fichaId)!

  const quando = agora().toISOString()
  const falhou = ficha.telefone === ''
  const registro: RegistroDasBoasVindas = falhou
    ? { fichaId: ficha.id, processoId, quando, situacao: 'falhou', mensagem, motivo: 'a ficha não tem telefone, e o Chatwoot não acha a conversa do cliente' }
    : { fichaId: ficha.id, processoId, quando, situacao: 'enviada', mensagem }
  banco.boasVindas = [...(banco.boasVindas ?? []), registro]
  if (falhou) {
    ficha.historico.push(evento(`As boas-vindas não saíram pelo Chatwoot: ${registro.motivo}. Ficou a tarefa "Reenviar boas-vindas"`))
  } else {
    const pendencias = atual.faltam.length === 0 ? 'sem pendências' : `${atual.faltam.length === 1 ? '1 pendência' : `${atual.faltam.length} pendências`} do checklist`
    ficha.historico.push(evento(`Enviou as boas-vindas pelo Chatwoot, com as cópias do kit e ${pendencias}`))
    ficha.contatos.push({ data: hojeIso(agora()), canal: 'Chatwoot', texto: 'Boas-vindas, com as cópias do kit e o que falta.' })
  }
  gravar(banco)
  return registro
}

/** "Reenviar boas-vindas" na Central do Atendimento: o caso cuja última tentativa falhou (CA6). */
export function tarefasDeReenviarBoasVindas(): Tarefa[] {
  const banco = ler()
  const tarefas = [...new Set((banco.boasVindas ?? []).map((r) => r.processoId))].flatMap((processoId) => {
    const atual = montar(banco, processoId)
    if (atual?.situacao !== 'falhou' || !atual.registro) return []
    return [
      {
        id: `boas-vindas-${processoId}`,
        codigo: 'D1.22',
        cliente: { id: atual.fichaId, nome: atual.nome },
        acao: 'Reenviar boas-vindas',
        detalhe: `não saíram pelo Chatwoot: ${atual.registro.motivo}`,
        prazo: 'hoje',
        urgente: true,
        href: `/casos/${processoId}/checklist`,
        processoId,
      },
    ]
  })
  // Bloco 5c: no caso do servidor, conferido o checklist do cliente novo, a Atendimento manda por fora e marca "Já enviei".
  const aEnviar = (banco.checklistsDoServidor ?? []).flatMap((c) => {
    const atual = c.conferencia ? montar(banco, c.processoId) : null
    if (atual?.situacao !== 'a-enviar') return []
    const n = atual.faltam.length
    return [
      {
        id: `boas-vindas-${c.processoId}`,
        codigo: 'D1.22',
        cliente: { id: atual.fichaId, nome: atual.nome },
        acao: 'Enviar boas-vindas',
        detalhe: `${c.beneficio} · checklist conferido · ${n === 0 ? 'sem pendências' : n === 1 ? '1 pendência' : `${n} pendências`}`,
        prazo: 'hoje',
        href: `/casos/${c.processoId}/checklist`,
        processoId: c.processoId,
      },
    ]
  })
  gravar(banco)
  return [...tarefas, ...aEnviar]
}
