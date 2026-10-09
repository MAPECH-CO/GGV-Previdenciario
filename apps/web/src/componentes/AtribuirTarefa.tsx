import { useEffect, useId, useRef, useState } from 'react'
import { normalizarData } from '@ggv/campos'
import { AtribuirTarefa as Corpo, type PessoaDoSetor, type TarefaDoSetor } from '@ggv/contratos'
import { atribuir } from '../dados/setor.ts'
import styles from './AtribuirTarefa.module.css'

/** A partir de quantas tarefas a barra de carga fica amarela e vermelha (Figma 1600:1282). Parâmetro de tela. */
const CARGA_MEDIA = 3
const CARGA_ALTA = 4

export const iniciais = (nome: string) =>
  nome
    .replace(/\(.*\)/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

const tomDaCarga = (carga: number) => (carga >= CARGA_ALTA ? styles.alta : carga >= CARGA_MEDIA ? styles.media : styles.leve)

type Props = {
  tarefa: TarefaDoSetor
  pessoas: PessoaDoSetor[]
  /** O nome de quem está na sessão: a linha dela aparece como "Você". */
  eu: string | undefined
  aoFechar: () => void
  aoAtribuir: () => void
}

/**
 * "Atribuir tarefa" (Figma 1600:1282 e 1600:1358): quem faz, com a carga de cada pessoa; o prazo (o da tarefa, se ficar
 * em branco), a prioridade e o recado. Quem atribui fica no histórico; quem recebe vê em "Minhas tarefas".
 */
export function AtribuirTarefa({ tarefa, pessoas, eu, aoFechar, aoAtribuir }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const ids = { titulo: useId(), prazo: useId(), prioridade: useId(), recado: useId() }
  const [quem, setQuem] = useState<string | null>(tarefa.responsavel?.id ?? null)
  const [prazo, setPrazo] = useState('')
  const [prioridade, setPrioridade] = useState<'normal' | 'alta'>(tarefa.prioridade ?? 'normal')
  const [recado, setRecado] = useState(tarefa.recado ?? '')
  const [avisar, setAvisar] = useState(true)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const d = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof d?.showModal === 'function') {
      if (!d.open) d.showModal()
    } else d?.setAttribute('open', '')
  }, [])

  async function enviar(responsavelId: string | null) {
    const entrada = Corpo.safeParse({ tarefaId: tarefa.id, responsavelId, prazo, prioridade, recado, avisar })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira a atribuição.')
    setEnviando(true)
    const falha = await atribuir({ tarefaId: tarefa.id, responsavelId, prazo, prioridade, recado, avisar })
    setEnviando(false)
    if (falha) return setErro(falha)
    aoAtribuir()
  }

  const sobre = [tarefa.codigo, tarefa.acao, tarefa.cliente?.nome ?? tarefa.contexto, tarefa.detalhe, tarefa.prazo].filter(Boolean).join(' · ')

  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby={ids.titulo} onClose={aoFechar}>
      <div className={styles.cabeca}>
        <div>
          <h2 id={ids.titulo} className={styles.titulo}>
            Atribuir tarefa
          </h2>
          <p className={styles.sobre}>{sobre}</p>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>

      <fieldset className={styles.quem}>
        <legend className={styles.rotulo}>Quem faz</legend>
        {pessoas.map((p) => (
          <label key={p.id} className={`${styles.pessoa} ${quem === p.id ? styles.escolhida : ''}`}>
            <input type="radio" name="quem-faz" checked={quem === p.id} onChange={() => setQuem(p.id)} />
            <span className={styles.avatar} aria-hidden="true">
              {iniciais(p.nome === eu ? 'Você' : p.nome)}
            </span>
            <span className={styles.nome}>
              {p.nome === eu ? 'Você' : p.nome}
              <span className={styles.funcao}>{p.funcao}</span>
            </span>
            <span className={styles.carga} aria-label={`${p.carga} ${p.carga === 1 ? 'tarefa' : 'tarefas'} com ${p.nome === eu ? 'você' : p.nome}`}>
              <span className={styles.barra}>
                <span className={`${styles.preenchido} ${tomDaCarga(p.carga)}`} style={{ width: `${Math.min(p.carga / 5, 1) * 100}%` }} />
              </span>
              {p.carga} hoje
            </span>
          </label>
        ))}
      </fieldset>

      <div className={styles.linha}>
        <label className={styles.campo}>
          <span className={styles.rotuloPequeno}>Prazo</span>
          <input
            id={ids.prazo}
            className={styles.entrada}
            inputMode="numeric"
            placeholder={tarefa.prazo ? `${tarefa.prazo} (sugerido pelo portal)` : 'dd/mm/aaaa'}
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            onBlur={() => setPrazo((v) => (v ? normalizarData(v) : v))}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotuloPequeno}>Prioridade</span>
          <select id={ids.prioridade} className={styles.entrada} value={prioridade} onChange={(e) => setPrioridade(e.target.value as 'normal' | 'alta')}>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </select>
        </label>
      </div>
      <label className={styles.campo}>
        <span className={styles.rotuloPequeno}>Recado (opcional)</span>
        <textarea id={ids.recado} className={styles.entrada} rows={2} maxLength={500} value={recado} onChange={(e) => setRecado(e.target.value)} />
      </label>
      <label className={styles.avisar}>
        <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} /> Avisar a pessoa na Central dela
      </label>
      <p className={styles.nota}>
        Quem atribui fica no histórico (quem, quando, para quem). Só o líder do setor atribui; quem recebe vê a tarefa em "Minhas tarefas".
      </p>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.botoes}>
        <button type="button" className={styles.primario} disabled={enviando || !quem} onClick={() => void enviar(quem)}>
          Atribuir
        </button>
        <button type="button" className={styles.botao} disabled={enviando} onClick={() => void enviar(null)}>
          Deixar sem responsável
        </button>
        {tarefa.href && (
          <a className={styles.botao} href={tarefa.href}>
            Abrir a tarefa
          </a>
        )}
      </div>
    </dialog>
  )
}
