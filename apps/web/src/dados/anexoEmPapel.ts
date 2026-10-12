import { formatoDoArquivo, hashDoConteudo, problemaDoArquivo } from '../regras/arquivos.ts'
import { doServidor, noBanco, receber } from './servidor.ts'
import type { Ficha } from './tipos.ts'

/** Usa as duas rotas existentes: metadados e conteúdo. Sucesso só depois de guardar os bytes. */
export async function anexarPapel(fichaId: string, arquivo: File, tipo: 'contrato' | 'ficha-atendimento', processoId?: string): Promise<void> {
  if (!doServidor(fichaId)) throw new Error('O envio de arquivo está disponível somente para fichas do servidor.')
  const problema = problemaDoArquivo({ nome: arquivo.name, tamanho: arquivo.size })
  if (problema) throw new Error(problema)
  // A rota atual escolhe o primeiro caso. Não mandar contrato se a vinculação puder ser ambígua.
  const ficha = await noBanco<Ficha>(`/fichas/${fichaId}`)
  if (tipo === 'contrato' && (ficha.processos.length !== 1 || ficha.processos[0].id !== processoId)) {
    throw new Error('Envio indisponível: o servidor ainda não permite escolher o caso deste contrato.')
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
