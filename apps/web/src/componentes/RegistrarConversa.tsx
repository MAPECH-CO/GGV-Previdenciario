import { useEffect, useId, useRef, useState } from 'react'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { abrirConversa, type Conversa } from '../dados/conversa.ts'
import { usePerfil } from '../dados/perfis.ts'
import type { Ficha } from '../dados/tipos.ts'
import {
  CANAIS_DO_REGISTRO,
  COM_QUEM,
  MODOS_DO_REGISTRO,
  TAMANHO_DO_REGISTRO,
  modoDoCanal,
  motivoParaNaoAbrir,
  papelDoPerfil,
  type CanalDoRegistro,
  type ComQuem,
  type ModoDoRegistro,
} from '../regras/conversa.ts'
import styles from './RegistrarConversa.module.css'

type Props = {
  ficha: Ficha
  /** O processo de onde a janela abriu (a página do processo); sem ele, a pessoa escolhe quando há mais de um. */
  processoId?: string
  /** A função da tela, até a pessoa escolher outro perfil. */
  funcao?: string
  aoFechar: () => void
  /** Aberta a conversa, a tela do passo. O teste troca. */
  aoAbrir?: (c: Conversa) => void
}

const BOTAO: Record<ModoDoRegistro, string> = { 'tempo-real': 'Iniciar conversa', arquivo: 'Anexar o áudio', escrito: 'Salvar o registro' }

/**
 * Figma "Overlay · Registrar conversa" (2144:2), com as decisões do cartão GGVP-76: só ligação e presencial (Lucas, 06/10);
 * "Iniciar conversa" escolhe entre a transcrição em tempo real e anexar o arquivo da ligação (Pedro, 07/10).
 */
export function RegistrarConversa({ ficha, processoId: doProcesso, funcao = 'Atendimento', aoFechar, aoAbrir = (c) => window.location.assign(`/conversas/${c.id}`) }: Props) {
  const perfil = usePerfil(funcao)
  const janela = useRef<HTMLDialogElement>(null)
  const idCanal = useId()
  const idComQuem = useId()
  const idModo = useId()
  const idTexto = useId()
  const [canal, setCanal] = useState<CanalDoRegistro | undefined>()
  const [comQuem, setComQuem] = useState<ComQuem>('cliente')
  const [modo, setModo] = useState<ModoDoRegistro | undefined>()
  const [processoId, setProcessoId] = useState<string | undefined>(doProcesso ?? (ficha.processos.length === 1 ? ficha.processos[0].id : undefined))
  const [registro, setRegistro] = useState('')
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  const processo = ficha.processos.find((p) => p.id === processoId)
  const ondeFica = ficha.processos.length === 0 ? 'o registro fica na ficha do lead' : 'o registro fica no processo'
  const pedido = { canal, comQuem, modo, processoId, registro: modo === 'escrito' ? registro : undefined }
  const motivoParado = motivoParaNaoAbrir(pedido, papelDoPerfil(perfil?.id), ficha.processos.map((p) => p.id))

  function escolherCanal(c: CanalDoRegistro) {
    setCanal(c)
    // O canal sugere o modo; quem já escolheu o modo, mantém.
    setModo((m) => m ?? modoDoCanal(c))
  }

  async function abrir() {
    if (travado.current || motivoParado || !perfil) return
    travado.current = true
    setAbrindo(true)
    setErro('')
    try {
      aoAbrir(await abrirConversa(ficha.id, { canal: canal!, comQuem, modo: modo!, processoId, registro: pedido.registro }))
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para abrir a conversa.')
    } finally {
      travado.current = false
      setAbrindo(false)
    }
  }

  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="registrar-conversa-titulo" onClose={aoFechar}>
      <header className={styles.cabeca}>
        <div>
          <h2 id="registrar-conversa-titulo" className={styles.titulo}>
            <span className={styles.play} aria-hidden="true">
              ▶{' '}
            </span>
            Registrar conversa com o cliente
          </h2>
          <p className={styles.sub}>{[ficha.nome, processo?.numero ?? (processo && nomeBeneficio(processo.beneficio)), ondeFica].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </header>

      <div className={styles.corpo}>
        <div className={styles.grupo}>
          <p id={idCanal} className={styles.rotulo}>
            Canal
          </p>
          <div className={styles.chips} role="radiogroup" aria-labelledby={idCanal}>
            {(Object.keys(CANAIS_DO_REGISTRO) as CanalDoRegistro[]).map((c) => (
              <button key={c} type="button" role="radio" className={styles.chip} aria-checked={canal === c} onClick={() => escolherCanal(c)}>
                {CANAIS_DO_REGISTRO[c].rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.grupo}>
          <p id={idComQuem} className={styles.rotulo}>
            Com quem falou
          </p>
          <div className={styles.chips} role="radiogroup" aria-labelledby={idComQuem}>
            {(Object.keys(COM_QUEM) as ComQuem[]).map((q) => (
              <button key={q} type="button" role="radio" className={styles.chip} aria-checked={comQuem === q} onClick={() => setComQuem(q)}>
                {COM_QUEM[q]}
              </button>
            ))}
          </div>
        </div>

        {ficha.processos.length > 1 && (
          <label className={styles.grupo}>
            <span className={styles.rotulo}>Processo</span>
            <select className={styles.entrada} value={processoId ?? ''} onChange={(e) => setProcessoId(e.target.value || undefined)}>
              <option value="">Escolha o processo</option>
              {ficha.processos.map((p) => (
                <option key={p.id} value={p.id}>
                  {[nomeBeneficio(p.beneficio), p.etapa].join(' · ')}
                </option>
              ))}
            </select>
          </label>
        )}

        <fieldset className={styles.grupo}>
          <legend id={idModo} className={styles.rotulo}>
            Gravação
          </legend>
          {(Object.keys(MODOS_DO_REGISTRO) as ModoDoRegistro[]).map((m) => (
            <label key={m} className={styles.radio}>
              <input type="radio" name={idModo} checked={modo === m} onChange={() => setModo(m)} />
              {MODOS_DO_REGISTRO[m].rotulo} · {MODOS_DO_REGISTRO[m].detalhe}
            </label>
          ))}
        </fieldset>

        {modo === 'escrito' ? (
          <div className={styles.grupo}>
            <label className={styles.rotulo} htmlFor={idTexto}>
              Resumo da conversa *
            </label>
            <textarea
              id={idTexto}
              className={styles.entrada}
              rows={4}
              maxLength={TAMANHO_DO_REGISTRO.maximo}
              placeholder="O que foi falado e o que ficou combinado."
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
            />
          </div>
        ) : (
          <p className={styles.nota}>Com gravação, a IA escreve o resumo e você confere.</p>
        )}

        <p className={styles.ia}>
          <span aria-hidden="true">✦ </span>A IA resume e marca o que muda na ficha; nada vai para a ficha sem você conferir.
        </p>
        <p className={styles.nota}>Dado de saúde é sensível: {ondeFica}, com acesso por perfil.</p>
      </div>

      <footer className={styles.pe}>
        {(motivoParado || erro) && (
          <p className={styles.motivo} role={erro ? 'alert' : undefined}>
            {erro || motivoParado}
          </p>
        )}
        <button type="button" className={styles.secundario} onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className={styles.primario} disabled={motivoParado !== null || abrindo} onClick={abrir}>
          {abrindo ? 'abrindo…' : BOTAO[modo ?? 'tempo-real']}
        </button>
      </footer>
    </dialog>
  )
}
