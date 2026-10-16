import { useEffect, useId, useRef, useState } from 'react'
import type { ProcessoParaCusto } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import janela from './AtribuirTarefa.module.css'
import { FormularioDoCusto } from './CustasDoProcesso.tsx'
import styles from './NovoCusto.module.css'

const ESPERA_DA_BUSCA = 300
export const MSG_ESCOLHA_O_PROCESSO = 'Escolha o processo do custo.'

const detalhe = (p: ProcessoParaCusto) => [p.beneficio ?? 'benefício a definir', p.fase].join(' · ')

type Props = { podeAprovar: boolean; aoFechar: () => void; aoLancar: (aviso: string) => void }

/**
 * "Novo custo" (Pedro, 16/10): o Financeiro lança o custo de qualquer processo pela visão das custas. Primeiro o processo,
 * achado pelo nome, CPF ou telefone do cliente e escolhido um só; depois o mesmo formulário do card do processo.
 */
export function NovoCusto({ podeAprovar, aoFechar, aoLancar }: Props) {
  const caixa = useRef<HTMLDialogElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const ids = { titulo: useId(), lista: useId() }
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<ProcessoParaCusto[] | null>(null)
  const [erroDaBusca, setErroDaBusca] = useState('')
  const [escolhido, setEscolhido] = useState<ProcessoParaCusto | null>(null)
  const buscando = !escolhido && termo.trim().length >= 2

  useEffect(() => {
    const d = caixa.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof d?.showModal === 'function') {
      if (!d.open) d.showModal()
    } else d?.setAttribute('open', '')
  }, [])

  // Busca enquanto digita, com uma pausa curta; a partir de duas letras ou números.
  useEffect(() => {
    if (!buscando) return
    let valendo = true
    const relogio = window.setTimeout(() => {
      void chamarApi<ProcessoParaCusto[]>(`/custas/processos?busca=${encodeURIComponent(termo.trim())}`)
        .then((r) => {
          if (!valendo) return
          setAchados(r.ok ? r.dados : [])
          setErroDaBusca(r.ok ? '' : r.erro)
        })
        .catch(() => valendo && setErroDaBusca('A busca está indisponível agora. Tente de novo em instantes.'))
    }, ESPERA_DA_BUSCA)
    return () => {
      valendo = false
      window.clearTimeout(relogio)
    }
  }, [termo, buscando])

  const lista = buscando ? achados : null
  const trocar = () => {
    setEscolhido(null)
    window.setTimeout(() => campo.current?.focus())
  }

  return (
    <dialog ref={caixa} className={`${janela.janela} ${styles.janela}`} aria-labelledby={ids.titulo} onClose={aoFechar}>
      <div className={janela.cabeca}>
        <div>
          <h2 id={ids.titulo} className={janela.titulo}>
            Novo custo
          </h2>
          <p className={janela.sobre}>{podeAprovar ? 'O custo que você lança já entra aprovado.' : 'O custo espera o Financeiro aprovar.'}</p>
        </div>
        <button type="button" className={janela.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>

      <div className={styles.processo}>
        <span className={styles.rotulo}>Processo</span>
        {escolhido ? (
          <div className={styles.escolhido}>
            <span>
              <strong>{escolhido.cliente}</strong>
              <span className={styles.sub}>{detalhe(escolhido)}</span>
            </span>
            <button type="button" className={styles.trocar} onClick={trocar}>
              Trocar
            </button>
          </div>
        ) : (
          <>
            <input
              ref={campo}
              className={janela.entrada}
              type="search"
              autoComplete="off"
              aria-label="Buscar o processo pelo nome, CPF ou telefone do cliente"
              aria-controls={ids.lista}
              placeholder="Nome, CPF ou telefone do cliente"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
            />
            {buscando && erroDaBusca && (
              <p role="alert" className={styles.aviso}>
                {erroDaBusca}
              </p>
            )}
            {lista?.length === 0 && !erroDaBusca && <p className={styles.aviso}>Nenhum processo com esse nome, CPF ou telefone.</p>}
            {lista && lista.length > 0 && (
              <ul id={ids.lista} className={styles.lista} aria-label="Processos encontrados">
                {lista.map((p) => (
                  <li key={p.casoId}>
                    <button type="button" className={styles.opcao} aria-label={`${p.cliente} · ${detalhe(p)}`} onClick={() => setEscolhido(p)}>
                      <strong>{p.cliente}</strong>
                      <span className={styles.sub}>{detalhe(p)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <FormularioDoCusto
        casoId={escolhido?.casoId ?? null}
        podeAprovar={podeAprovar}
        comTitulo={false}
        falta={() => (escolhido ? null : MSG_ESCOLHA_O_PROCESSO)}
        aoLancar={(aviso) => aoLancar(`${escolhido!.cliente}: ${aviso}`)}
      />
    </dialog>
  )
}
