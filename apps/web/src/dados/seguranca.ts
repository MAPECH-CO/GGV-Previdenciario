// A segurança do contato (GGVP-111), no servidor (GGVP-138): telefone, e-mail e dados bancários só mudam com o cliente
// verificado e em contrato novo; a mudança bancária tem a segunda confirmação, o aviso ao contato anterior e o alerta da
// prestação de contas. Tudo isso é conferido no servidor, com o perfil da sessão. O servidor de exemplo daqui saiu.
import type { PedidoBancario as PedidoDoContrato, RegistroBancario as RegistroDoContrato } from '@ggv/contratos'
import { camposProtegidosQueMudam, motivoParaNaoMudar, type DadosBancarios, type Verificacao } from '../regras/seguranca.ts'
import { fichaComCpf } from '../regras/duplicidade.ts'
import { daSemente, doServidor, espelhar, ler, noBanco, salvarFicha } from './servidor.ts'
import type { EdicaoFicha, Ficha } from './tipos.ts'

// O que a edição muda de telefone e e-mail é regra pura, que o servidor também usa (GGVP-138).
export { camposProtegidosQueMudam }

/** Os dados bancários em vigor de uma ficha, com quem pediu e desde quando valem. */
export type RegistroBancario = RegistroDoContrato

/** O pedido de mudança, esperando a segunda confirmação (CA5). */
export type PedidoBancario = PedidoDoContrato

/** GET /api/fichas/:id/dados-bancarios. Os dados em vigor e o pedido que espera a segunda confirmação. */
export const obterDadosBancarios = (fichaId: string) => noBanco<{ atual: RegistroBancario | null; pedido: PedidoBancario | null }>(`/fichas/${fichaId}/dados-bancarios`)

/** POST /api/fichas/:id/dados-bancarios. Só com o cliente verificado e em contrato novo (CA1); espera a segunda confirmação (CA5). */
export const pedirMudancaBancaria = (fichaId: string, pedido: { dados: DadosBancarios; verificacao: Partial<Verificacao> | null }) =>
  noBanco<PedidoBancario>(`/fichas/${fichaId}/dados-bancarios`, { method: 'POST', corpo: pedido })

/** POST /api/fichas/:id/dados-bancarios/confirmacao. A segunda pessoa confirma; o contato anterior recebe o aviso (CA5). */
export const confirmarMudancaBancaria = (fichaId: string) => noBanco<RegistroBancario>(`/fichas/${fichaId}/dados-bancarios/confirmacao`, { method: 'POST' })

/**
 * PATCH /api/fichas/:id com a verificação (CA1): mudar o telefone ou o e-mail só com o cliente verificado e em contrato
 * novo; o servidor confere e põe o antigo e o novo no histórico. A ficha da semente segue a edição da Recepção, com a
 * mesma regra conferida aqui.
 */
export async function salvarFichaVerificada(id: string, edicao: EdicaoFicha, verificacao: Partial<Verificacao> | null): ReturnType<typeof salvarFicha> {
  if (!doServidor(id)) {
    const antes = ler().fichas.find((f) => f.id === id)
    if (!antes) throw new Error('Ficha não encontrada')
    const motivo = camposProtegidosQueMudam(antes, edicao)
      .map((campo) => motivoParaNaoMudar(campo, verificacao))
      .find(Boolean)
    if (motivo) throw new Error(motivo)
    return salvarFicha(id, edicao)
  }
  const daSementeComCpf = fichaComCpf(daSemente(ler().fichas), edicao.cpf)
  if (daSementeComCpf) return { erro: 'cpf-de-outra-ficha', nome: daSementeComCpf.nome }
  const r = await noBanco<{ ficha: Ficha } | { erro: 'cpf-de-outra-ficha'; nome: string }>(`/fichas/${id}`, { method: 'PATCH', corpo: { ...edicao, verificacao } })
  return 'erro' in r ? r : { ficha: espelhar(r.ficha) }
}
