import { formatoDoArquivo, hashDoConteudo, problemaDoArquivo } from '../regras/arquivos.ts'
import { doServidor, noBanco, receber } from './servidor.ts'
import type { Ficha } from './tipos.ts'

/**
 * O papel digitalizado sobe para o servidor. O contrato assinado vai pela rota do contrato (GGVP-158 E11), que guarda o
 * arquivo como documento do caso e o liga à assinatura, para "Concluir a assinatura" habilitar. A ficha de atendimento
 * usa as duas rotas da pasta: metadados e conteúdo. Sucesso só depois de guardar os bytes.
 */
export async function anexarPapel(fichaId: string, arquivo: File, tipo: 'contrato' | 'ficha-atendimento', processoId?: string): Promise<void> {
  if (!doServidor(fichaId)) throw new Error('O envio de arquivo está disponível somente para fichas do servidor.')
  const problema = problemaDoArquivo({ nome: arquivo.name, tamanho: arquivo.size })
  if (problema) throw new Error(problema)
  if (tipo === 'contrato') {
    if (!processoId) throw new Error('Envio indisponível: o contrato não tem caso.')
    const corpo = new FormData()
    corpo.set('arquivo', arquivo)
    receber(await noBanco<Parameters<typeof receber>[0]>(`/processos/${processoId}/contrato/digitalizacao`, { method: 'POST', corpo }))
    return
  }
  const hash = await hashDoConteudo(await arquivo.arrayBuffer())
  const r = await noBanco<{ ficha: Ficha }>(`/fichas/${fichaId}/arquivos`, {
    method: 'POST', corpo: { origem: 'card', arquivos: [{ nome: arquivo.name, tamanho: arquivo.size, formato: formatoDoArquivo(arquivo.name), tipo, hash }] },
  })
  const corpo = new FormData()
  corpo.set('hash', hash)
  corpo.set('arquivo', arquivo)
  await noBanco(`/fichas/${fichaId}/arquivos/conteudo`, { method: 'POST', corpo })
  receber(r)
}
