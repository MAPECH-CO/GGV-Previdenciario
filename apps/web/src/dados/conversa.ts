// A conversa com o lead ou o cliente (fluxo D5, GGVP-12), no servidor (GGVP-138): cada função chama a rota da API, com o
// perfil da sessão. A gravação é a mesma da entrevista (GGVP-40), simulada no servidor até a de verdade; a transcrição
// também. Quem conduz, quem confere e o que cada perfil pode são conferidos lá. O servidor de exemplo daqui saiu.
import { useEffect, useState } from 'react'
import type { Conferencia as ConferenciaDoContrato, Conversa as ConversaDoContrato, Pendencia as PendenciaDoContrato } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import type { CanalDoRegistro, ComQuem, DecisaoDaMudanca, Dito, ModoDoRegistro, Mudanca, Pessoa, VersaoDoCampo } from '../regras/conversa.ts'
import { falasDaConversa, type FalaDaConversa } from './conversaSimulada.ts'
import { PESSOAS_DO_ESCRITORIO_DE_EXEMPLO } from './exemplo.ts'
import { noBanco, receber } from './servidor.ts'
import type { AcaoNaGravacao, Ficha, Gravacao, Tarefa } from './tipos.ts'

/** A conversa do D5: quem conduziu, o canal, com quem, como foi registrada, a análise, a conferência e a pendência. */
export type Conversa = ConversaDoContrato

/** O quadro da IA depois de transcrever: o que mudou, o que precisa atualizar, a observação e o combinado (GGVP-80). */
export type AnaliseDaConversa = { mudancas: Mudanca[]; atualizar: Dito['onde'][]; observacao: string; pendencia?: string }

/** O que a tela pede ao abrir a conversa (Figma 2144:2). */
export type NovaConversa = { canal: CanalDoRegistro; comQuem: ComQuem; modo: ModoDoRegistro; processoId?: string; registro?: string }

/** O áudio da ligação já feita, com a confirmação de que ele começa com o aviso de gravação (G10). */
export type AudioDaLigacao = { nome: string; tipo: string; tamanho: number; avisoNaGravacao: true }

export type ConversaAberta = { conversa: Conversa; ficha: Ficha; gravacao?: Gravacao }

// A fala simulada da conversa: a tela mostra a transcrição ao vivo com ela; o servidor transcreve com a mesma.
export { falasDaConversa, type FalaDaConversa }

/** "Surgiu pendência?" (GGVP-88): o combinado, quem fica com a tarefa (nunca presumido) e o prazo (dd/mm/aaaa). */
export type NovaPendencia = { surgiu: false } | { surgiu: true; texto: string; responsavel: string; prazo: string }

/** A pendência que virou tarefa no card (GGVP-88). */
export type Pendencia = PendenciaDoContrato

/** O que a tela manda ao conferir: a decisão de cada mudança, a pendência e, para telefone e e-mail, a verificação. */
export type Conferencia = ConferenciaDoContrato & { decisoes: DecisaoDaMudanca[] }

/** A resposta das rotas da conversa: a ficha e a gravação vão também para a cópia das telas ainda não ligadas. */
function recebida(r: ConversaAberta): ConversaAberta {
  receber({ ficha: r.ficha, gravacao: r.gravacao })
  return r
}
const pedir = async (caminho: string, corpo: unknown = {}) => recebida(await noBanco<ConversaAberta>(caminho, { method: 'POST', corpo }))

/** POST /api/conversas. Abre a conversa no card do lead ou do cliente (CA3, CA4, CA9); só escrita, já é "só registro". */
export async function abrirConversa(fichaId: string, pedido: NovaConversa): Promise<Conversa> {
  return (await pedir('/conversas', { fichaId, ...pedido })).conversa
}

/** GET /api/conversas/:id. Nulo quando a conversa não existe ou o perfil não abre. */
export async function obterConversa(conversaId: string): Promise<ConversaAberta | null> {
  const r = await chamarApi<ConversaAberta>(`/conversas/${conversaId}`)
  return r.ok ? recebida(r.dados) : null
}

/** POST /api/conversas/:id/gravacao. Só grava com o aviso registrado, com a hora (CA1, CA5, G10). */
export const gravarConversa = (conversaId: string, inicio: { avisei: true }) => pedir(`/conversas/${conversaId}/gravacao`, inicio)

/** POST /api/conversas/:id/acoes. Pausar, retomar e o cofre, como na entrevista: com a hora e o ponto do áudio. */
export const registrarAcaoNaConversa = (conversaId: string, acao: Extract<AcaoNaGravacao['acao'], 'pausou' | 'retomou' | 'abriu-cofre' | 'guardou-senha' | 'falhou'>, aos: number) =>
  pedir(`/conversas/${conversaId}/acoes`, { acao, aos })

/** POST /api/conversas/:id/finalizar. O áudio fica no card do lead ou cliente e vai para a transcrição (CA6, CA9). */
export const finalizarConversa = (conversaId: string, fim: { aos: number }) => pedir(`/conversas/${conversaId}/finalizar`, fim)

/** POST /api/conversas/:id/audio. A ligação já feita sobe gravada, de qualquer formato e tamanho, com o aviso nela (CA2, G10). */
export const anexarAudio = (conversaId: string, arquivo: AudioDaLigacao) => pedir(`/conversas/${conversaId}/audio`, arquivo)

/** POST /api/conversas/:id/transcricao. `falhar` simula a falha; chamar de novo tenta outra vez (GGVP-80). */
export const transcreverConversa = (conversaId: string, opcoes: { falhar?: boolean } = {}) => pedir(`/conversas/${conversaId}/transcricao`, opcoes)

/** POST /api/conversas/:id/conferencia. Quem fez a conversa confere na hora; depois, o Jurídico, no que só ele pode (GGVP-84). */
export const conferirConversa = (conversaId: string, conferencia: Conferencia) => pedir(`/conversas/${conversaId}/conferencia`, conferencia)

/** POST /api/conversas/:id/pendencia/cumprida. O responsável ou a Sênior dá a pendência por cumprida (GGVP-88). */
export const cumprirPendencia = (conversaId: string) => pedir(`/conversas/${conversaId}/pendencia/cumprida`)

/** POST /api/conversas/:id/pendencia/prazo. Só a Sênior, com a pendência atrasada (GGVP-88, CA5). */
export const novoPrazoDaPendencia = (conversaId: string, prazo: string) => pedir(`/conversas/${conversaId}/pendencia/prazo`, { prazo })

/** GET /api/fichas/:id/versoes. As versões dos campos da ficha e dos processos dela, da mais antiga à mais nova (GGVP-84). */
export const obterVersoes = (fichaId: string) => noBanco<VersaoDoCampo[]>(`/fichas/${fichaId}/versoes`)

/** POST /api/fichas/:id/versoes/:campo/volta. Só a Sênior; a volta vira versão nova e entra no histórico (GGVP-84, CA2). */
export async function voltarParaVersao(alvo: Pick<VersaoDoCampo, 'fichaId' | 'processoId' | 'onde' | 'campo'>, indice: number): Promise<VersaoDoCampo[]> {
  return noBanco<VersaoDoCampo[]>(`/fichas/${alvo.fichaId}/versoes/${alvo.campo}/volta`, {
    method: 'POST',
    corpo: { onde: alvo.onde, versao: indice, ...(alvo.processoId && { processoId: alvo.processoId }) },
  })
}

/** GET /api/conversas/responsaveis. Quem pode ficar com a pendência: as pessoas do escritório, com o setor (GGVP-88, CA3). */
export const responsaveisDaPendencia = () => noBanco<Pessoa[]>('/conversas/responsaveis')

/**
 * As tarefas da conversa na Central de quem está no login: "Registrar conversa" (GGVP-76, CA8), "Cumprir pendência" e,
 * para a Sênior, "Pendência atrasada" (GGVP-88, CA4, CA5). Nulo enquanto carrega.
 */
export function useTarefasDaConversa(): Tarefa[] | null {
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null)
  useEffect(() => {
    chamarApi<Tarefa[]>('/conversas/tarefas')
      .then((r) => setTarefas(r.ok && Array.isArray(r.dados) ? r.dados : []))
      .catch(() => setTarefas([]))
  }, [])
  return tarefas
}

/** A conversa de uma gravação: as Transcrições levam à conferência dela, em vez de "Conferir e levar" (GGVP-80, CA6). */
export const conversaDaGravacao = (g: Pick<Gravacao, 'conversaId'>) => g.conversaId

/** As pessoas do chat (GGVP-82), que ainda é de exemplo. A pendência da conversa usa as do servidor (`responsaveisDaPendencia`). */
export const pessoasDoEscritorio = (): Pessoa[] => PESSOAS_DO_ESCRITORIO_DE_EXEMPLO
