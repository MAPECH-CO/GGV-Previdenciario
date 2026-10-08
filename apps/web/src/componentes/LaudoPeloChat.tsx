import { useState } from 'react'
import { enviarArquivos, identificarCliente } from '../dados/documentos.ts'
import { obterFicha } from '../dados/servidor.ts'
import { LEMBRETE_DA_IDENTIDADE } from '../regras/seguranca.ts'
import type { ArquivoParaEnviar } from '../dados/tipos.ts'
import { formatoDoArquivo, hashDoConteudo, problemaDoArquivo } from '../regras/arquivos.ts'
import { CartaoConfirmacao, type EstadoAcao } from './CartaoConfirmacao.tsx'
import { ChatIA } from './ChatIA.tsx'
import styles from './LaudoPeloChat.module.css'

type Acao = { cliente: { id: string; nome: string }; arquivo: ArquivoParaEnviar; estado: EstadoAcao }
type Mensagem = { id: number; de: 'voce' | 'ia'; texto: string; anexo?: string; acao?: Acao }

let proximoId = 0

/**
 * O chat da Central do Atendimento com o "Subir laudo novo" ligado (GGVP-17, CA8; Figma 2052:2). A IA é simulada:
 * o cliente sai da mensagem e do nome do arquivo, e nada acontece antes de "Confirmar". O resto do chat é da GGVP-82.
 */
export function LaudoPeloChat({ exemplo, sugestoes }: { exemplo: string; sugestoes: string[] }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const responder = (texto: string, acao?: Acao) => setMensagens((m) => [...m, { id: ++proximoId, de: 'ia', texto, acao }])
  const mudarAcao = (id: number, estado: EstadoAcao) =>
    setMensagens((m) => m.map((x) => (x.id === id && x.acao ? { ...x, acao: { ...x.acao, estado } } : x)))

  async function aoAnexo(texto: string, anexo: File) {
    setMensagens((m) => [...m, { id: ++proximoId, de: 'voce', texto, anexo: anexo.name }])
    const problema = problemaDoArquivo({ nome: anexo.name, tamanho: anexo.size })
    if (problema) return responder(`Esse arquivo não segue: ${problema}`)
    const achados = await identificarCliente(`${texto} ${anexo.name}`)
    if (achados.length !== 1) {
      return responder(
        achados.length === 0
          ? 'Não identifiquei de quem é o laudo. Escreva o nome completo do cliente e envie de novo com o arquivo.'
          : `O nome bate com mais de um cliente (${achados.map((a) => a.nome).join(', ')}). Escreva o nome completo e envie de novo com o arquivo.`,
      )
    }
    const [cliente] = achados
    const hash = await hashDoConteudo(await anexo.arrayBuffer())
    const arquivo = { nome: anexo.name, formato: formatoDoArquivo(anexo.name)!, tamanho: anexo.size, tipo: 'laudo', hash }
    responder(
      `Li o arquivo e identifiquei o cliente: ${cliente.nome}${cliente.beneficio ? ` (${cliente.beneficio.toLowerCase()})` : ''}. ` +
        'Posso subir na pasta dele e avisar o Jurídico. A IA lê, resume e compara com o laudo em uso para a advogada; você só sobe e confirma.',
      { cliente: { id: cliente.id, nome: cliente.nome }, arquivo, estado: 'esperando' },
    )
  }

  /** "O cliente me ligou, qual é a próxima tarefa?": a tarefa e o lembrete de confirmar a identidade (GGVP-111, CA7). */
  function aoEnviar(texto: string) {
    // O resto do chat é da GGVP-82: sem tratar, o chat avisa e mantém o texto.
    if (!/ligou|liga[cç][aã]o/i.test(texto)) return false
    setMensagens((m) => [...m, { id: ++proximoId, de: 'voce', texto }])
    void proximaTarefa(texto)
  }

  async function proximaTarefa(texto: string) {
    const achados = await identificarCliente(texto)
    if (achados.length !== 1) {
      return responder(
        achados.length === 0
          ? 'Não identifiquei o cliente. Escreva o nome completo de quem ligou.'
          : `O nome bate com mais de um cliente (${achados.map((a) => a.nome).join(', ')}). Escreva o nome completo.`,
      )
    }
    const ficha = (await obterFicha(achados[0].id))!
    const primeiro = ficha.nome.split(' ')[0]
    const caso = ficha.processos[0]
    const proxima = caso?.proximaAcao
      ? `A próxima tarefa de ${primeiro} (${caso.etapa}) é ${caso.proximaAcao}${caso.prazo ? `, ${caso.prazo}` : ''}.`
      : `${primeiro} não tem caso em andamento: veja a ficha.`
    responder(`${proxima} ${LEMBRETE_DA_IDENTIDADE}`)
  }

  async function confirmar(mensagem: Mensagem) {
    const { cliente, arquivo } = mensagem.acao!
    const resposta = await enviarArquivos(cliente.id, { origem: 'chat', arquivos: [arquivo] })
    mudarAcao(mensagem.id, resposta.resultado === 'enviado' ? 'feito' : 'sem-pasta')
  }

  return (
    <ChatIA exemplo={exemplo} sugestoes={sugestoes} onAnexo={aoAnexo} onEnviar={aoEnviar}>
      {mensagens.length > 0 && (
        <ol className={styles.conversa} aria-label="Conversa">
          {mensagens.map((m) => (
            <li key={m.id} className={m.de === 'voce' ? styles.voce : styles.ia}>
              {m.anexo && <span className={styles.anexo}>▤ {m.anexo}</span>}
              {m.texto && <p>{m.texto}</p>}
              {m.acao && (
                <CartaoConfirmacao
                  cliente={m.acao.cliente}
                  arquivo={m.acao.arquivo.nome}
                  estado={m.acao.estado}
                  aoConfirmar={() => confirmar(m)}
                  aoCancelar={() => mudarAcao(m.id, 'cancelado')}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </ChatIA>
  )
}
