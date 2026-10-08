// EXEMPLO. Servidor de exemplo das boas-vindas (GGVP-97), sobre o mesmo banco de servidor.ts. O Chatwoot é simulado: a
// mensagem "sai" quando a ficha tem telefone; sem telefone, o Chatwoot não acha a conversa e o envio falha (CA6). Ligar
// no servidor: trocar o corpo de cada função por fetch no endpoint da spec da ggvp-97 e mandar pelo Chatwoot (GGVP-102).
import { jaEraCliente, mensagemDeBoasVindas } from '../regras/boasVindas.ts'
import { hojeIso } from '../regras/datas.ts'
import { checklistDoCaso, contratoAssinado } from './checklist.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Processo, Tarefa } from './tipos.ts'

/** Cada tentativa de envio: a que saiu e a que falhou. */
export type RegistroDasBoasVindas = {
  fichaId: string
  processoId: string
  /** Data e hora ISO. */
  quando: string
  situacao: 'enviada' | 'falhou'
  mensagem: string
  motivo?: string
}

export type BoasVindas = {
  /** 'ja-era-cliente': não vai (CA3); 'aguardando-checklist': sai depois da conferência do checklist (CA1). */
  situacao: 'ja-era-cliente' | 'aguardando-checklist' | 'a-enviar' | 'enviada' | 'falhou'
  /** A mensagem pelo modelo, para conferir (CA4, CA5); enviada, a que saiu. */
  mensagem: string
  copias: string[]
  faltam: string[]
  /** A última tentativa deste caso. */
  registro?: RegistroDasBoasVindas
}

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
  const copias = copiasDoKit(banco, processo)
  const registros = (banco.boasVindas ?? []).filter((r) => r.fichaId === ficha.id)
  const registro = registros.filter((r) => r.processoId === processoId).at(-1)
  const enviada = registros.find((r) => r.situacao === 'enviada')
  const base = { fichaId: ficha.id, nome: ficha.nome, copias, faltam: checklist.faltam, registro }
  if (enviada?.processoId === processoId) return { ...base, situacao: 'enviada', mensagem: enviada.mensagem, registro: enviada }
  // Uma única vez por cliente: quem já recebeu, ou já tinha outro processo, já era cliente (CA3, CA4).
  if (enviada || jaEraCliente(ficha, processoId)) return { ...base, situacao: 'ja-era-cliente', mensagem: '' }
  const mensagem = mensagemDeBoasVindas({ nome: ficha.nome, beneficio, copias, faltam: checklist.faltam })
  if (registro?.situacao === 'falhou') return { ...base, situacao: 'falhou', mensagem }
  return { ...base, situacao: conferencia ? 'a-enviar' : 'aguardando-checklist', mensagem }
}

/** GET /api/processos/:id/boas-vindas */
export async function obterBoasVindas(processoId: string): Promise<BoasVindas | null> {
  const banco = ler()
  const boasVindas = montar(banco, processoId)
  gravar(banco)
  return boasVindas
}

/** POST /api/processos/:id/boas-vindas. Uma vez, conferida, pelo Chatwoot; a falha fica no histórico e vira tarefa (CA4, CA6). */
export async function enviarBoasVindas(processoId: string, envio: EnvioDasBoasVindas): Promise<RegistroDasBoasVindas> {
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
  gravar(banco)
  return tarefas
}
