import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { obterEntrevista, subirAudio } from '../dados/entrevista.ts'
import { agora } from '../dados/servidor.ts'
import type { Entrevista as DadosDaEntrevista, Gravacao } from '../dados/tipos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { FORMATOS_DE_AUDIO } from '../regras/entrevista.ts'
import { motivoParaIniciar } from '../regras/preparacao.ts'
import styles from './Balcao.module.css'
import proprio from './Entrevista.module.css'

// Figma: step_D1.09 "Fazer entrevista" (14:65). A gravação acontece na tela seguinte (73:560); aqui também entra o áudio
// gravado fora do portal, como a ligação do Chatwoot baixada (CA9), de qualquer formato e tamanho (CA10).

const ACEITA = ['audio/*', ...FORMATOS_DE_AUDIO.map((f) => `.${f}`)].join(',')

function megas(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

export function Entrevista({ agendamentoId }: { agendamentoId: string }) {
  const idArquivo = useId()
  const [dados, setDados] = useState<DadosDaEntrevista | null | undefined>(undefined)
  const [subindo, setSubindo] = useState(false)
  const [subido, setSubido] = useState<Gravacao | null>(null)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterEntrevista(agendamentoId).then((d) => {
      if (valendo) setDados(d)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Fazer entrevista · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Entrevista não encontrada' : 'Abrindo a entrevista…'}</h1>
        {dados === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, agendamento: a, gravacao } = dados
  const quando = `${a.data === hoje ? 'hoje' : dataCurta(a.data, hoje)} ${a.hora}`
  const motivo = motivoParaIniciar(ficha)
  const encerrada = gravacao?.estado === 'encerrada'

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo || travado.current) return
    travado.current = true
    setSubindo(true)
    setErro('')
    try {
      const r = await subirAudio(agendamentoId, { nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }, arquivo)
      setSubido(r.gravacao)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para subir o áudio.')
    } finally {
      travado.current = false
      setSubindo(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Fazer entrevista · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Advogada responsável" inicio="/advogada" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.09 · Atender e entrevistar (passo do BPMN)">
                D1.09
              </span>
              <span className={proprio.advogada}>Advogada</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Fazer entrevista
            </h1>
            <p className={styles.subtitulo}>entrevista inicial · gravada · {quando}</p>
          </div>

          <section className={styles.cartao}>
            <p className={proprio.frase}>
              Iniciar a entrevista com o cliente — por vídeo, telefone ou presencial. A conversa é gravada e transcrita.
            </p>
          </section>

          <p className={styles.trava}>A gravação começa com o aviso ao cliente (G10).</p>

          <div className={styles.rodape}>
            {/* A entrevista iniciada na hora pula a preparação: o atalho da análise fica aqui também. */}
            {!ficha.analise && !encerrada && (
              <a className={styles.atalho} href={`/entrevista/${a.id}/analisar`}>
                Analisar a ficha
              </a>
            )}
            {encerrada ? (
              <a className={styles.principalBotao} href={`/entrevista/${a.id}/gravacao`}>
                Abrir a entrevista encerrada
              </a>
            ) : motivo ? (
              <button type="button" className={styles.principalBotao} disabled>
                Iniciar entrevista (Transcrição)
              </button>
            ) : (
              <a className={styles.principalBotao} href={`/entrevista/${a.id}/gravacao`}>
                Iniciar entrevista (Transcrição)
              </a>
            )}
            {motivo && !encerrada && <p className={styles.motivo}>{motivo}</p>}
          </div>

          <section className={styles.cartao} aria-labelledby="audio-de-fora">
            <h2 id="audio-de-fora" className={styles.cartaoTitulo}>
              Áudio gravado fora do portal
            </h2>
            <p className={proprio.texto}>
              A entrevista foi por telefone e a ligação ficou gravada no Chatwoot? A gravação fica na conversa do cliente, como
              mensagem privada: baixe o áudio e suba aqui. O portal não busca nada no Chatwoot. Qualquer formato de áudio, até 25 MB
              por arquivo.
            </p>
            {subido ? (
              <div className={styles.feito} role="status">
                <p className={styles.feitoTitulo}>
                  ✓ Áudio recebido: {subido.audio!.nome} ({megas(subido.audio!.tamanho)}
                  {subido.audio!.partes > 1 ? `, em ${subido.audio!.partes} partes` : ''})
                </p>
                <p>Foi para a transcrição (D1.11) e fica guardado no caso. Você recebeu «Cadastrar lead» (D1.10).</p>
                <a className={styles.atalho} href={`/entrevista/${a.id}/gravacao`}>
                  Abrir a entrevista
                </a>
              </div>
            ) : (
              <div>
                <label className={styles.atalho} htmlFor={idArquivo} data-desligado={subindo}>
                  {subindo ? 'subindo…' : 'Escolher o áudio'}
                </label>
                <input id={idArquivo} className="so-leitor" type="file" accept={ACEITA} disabled={subindo} onChange={escolher} />
              </div>
            )}
            {erro && (
              <p role="alert" className={styles.motivo}>
                {erro}
              </p>
            )}
          </section>
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.09.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>
            A entrevista começa com o aviso de gravação (G10); a senha do gov.br vai ao cofre (G9). Ao encerrar, a IA transcreve
            (D1.11), você cadastra o lead (D1.10) e define o benefício (D1.12).
          </p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
