import { useEffect, useRef, useState, type DragEvent } from 'react'
import { enviarArquivos } from '../dados/documentos.ts'
import type { RespostaEnvio } from '../dados/tipos.ts'
import { formatoDoArquivo, hashDoConteudo, problemaDoArquivo, tipoSugerido } from '../regras/arquivos.ts'
import styles from './ConferirEnviar.module.css'
import { LinhaArquivo, type Linha } from './LinhaArquivo.tsx'

type Props = {
  fichaId: string
  origem: 'card' | 'chat'
  /** Os arquivos soltos na área tracejada da ficha. */
  iniciais?: File[]
  aoEnviar: (resposta: Extract<RespostaEnvio, { resultado: 'enviado' }>) => void
  aoFechar: () => void
}

let proximoId = 0

function novaLinha(arquivo: File): Linha {
  const linha: Linha = { id: ++proximoId, nome: arquivo.name, tamanho: arquivo.size, tipo: tipoSugerido(arquivo.name), arquivo }
  linha.problema = problemaDoArquivo({ nome: linha.nome, tamanho: linha.tamanho })
  return linha
}

/** Janela "Conferir e enviar" (Figma 2224:2): a IA diz o tipo, a pessoa confere e envia para a pasta do cliente (CA12, CA13). */
export function ConferirEnviar({ fichaId, origem, iniciais = [], aoEnviar, aoFechar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const [linhas, setLinhas] = useState<Linha[]>(() => iniciais.map(novaLinha))
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)

  // O SHA-256 do conteúdo: o mesmo arquivo enviado duas vezes fica "repetido" (CA13).
  function ler(linha: Linha) {
    if (linha.problema || !linha.arquivo) return
    linha.arquivo
      .arrayBuffer()
      .then(hashDoConteudo)
      .then((hash) => setLinhas((atuais) => atuais.map((l) => (l.id === linha.id ? { ...l, hash } : l))))
  }

  function acrescentar(arquivos: File[]) {
    const novas = arquivos.map(novaLinha)
    setLinhas((atuais) => [...atuais, ...novas])
    novas.forEach(ler)
  }

  const [abertura] = useState(linhas)
  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
    abertura.forEach(ler)
  }, [abertura])

  const validas = linhas.filter((l) => !l.problema)
  const prontas = validas.length > 0 && validas.every((l) => l.hash)

  async function enviar() {
    if (travado.current || !prontas) return
    travado.current = true
    setEnviando(true)
    setAviso('')
    try {
      const arquivos = validas.map((l) => ({ nome: l.nome, formato: formatoDoArquivo(l.nome)!, tamanho: l.tamanho, tipo: l.tipo, hash: l.hash! }))
      const resposta = await enviarArquivos(fichaId, { origem, arquivos })
      if (resposta.resultado === 'sem-pasta') {
        setAviso('Esta ficha ainda não tem pasta no Drive, e pasta nova só nasce com o CPF. Complete o CPF na ficha e envie de novo.')
        return
      }
      aoEnviar(resposta)
    } catch {
      setAviso('Não deu para enviar. Confira os arquivos e tente de novo.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  function soltar(evento: DragEvent) {
    evento.preventDefault()
    acrescentar([...evento.dataTransfer.files])
  }

  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="conferir-titulo" onClose={aoFechar}>
      <div className={styles.cabeca}>
        <div className={styles.textos}>
          <h2 id="conferir-titulo" className={styles.titulo}>
            Conferir e enviar
          </h2>
          <p className={styles.subtitulo}>
            A IA identificou o tipo de cada arquivo. Confira e envie para a pasta do cliente, no Drive do escritório.
          </p>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>
      <div className={styles.corpo}>
        <label className={styles.area} onDragOver={(e) => e.preventDefault()} onDrop={soltar}>
          <svg className={styles.iconeEnviar} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 16V4m0 0-5 5m5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
          </svg>
          <span className={styles.areaTitulo}>Solte mais arquivos aqui ou clique para escolher</span>
          <span className={styles.areaSub}>PDF, JPG ou PNG · até 20 MB cada</span>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="so-leitor"
            onChange={(e) => {
              acrescentar([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </label>
        {linhas.length > 0 && (
          <ul className={styles.lista} aria-label="Arquivos para enviar">
            {linhas.map((l) => (
              <LinhaArquivo
                key={l.id}
                linha={l}
                aoMudarTipo={(tipo) => setLinhas((atuais) => atuais.map((x) => (x.id === l.id ? { ...x, tipo } : x)))}
              />
            ))}
          </ul>
        )}
        <p className={styles.avisoLaudo}>
          Se for laudo, o portal marca «Laudo novo» na ficha e no processo e avisa a advogada. Quem não é do Jurídico não vê o
          conteúdo do laudo (G17).
        </p>
        {aviso && (
          <p role="alert" className={styles.erro}>
            {aviso}
          </p>
        )}
      </div>
      <div className={styles.pe}>
        <button type="button" className={styles.cancelar} onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className={styles.enviar} disabled={!prontas || enviando} onClick={enviar}>
          {enviando ? 'enviando…' : 'Enviar para a pasta do cliente'}
        </button>
      </div>
    </dialog>
  )
}
