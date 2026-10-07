import { useEffect, useRef } from 'react'
import { CATEGORIAS_DA_AGENDA } from '../dados/catalogos.ts'
import type { EventoDaAgenda } from '../dados/tipos.ts'
import { dataLonga } from '../regras/agenda.ts'
import { NOMES_DA_INSTANCIA } from '../regras/pericia.ts'
import cat from './Categorias.module.css'
import styles from './DetalheCompromisso.module.css'

const ESTADO: Record<EventoDaAgenda['estado'], string> = {
  agendado: 'agendado',
  realizado: 'realizado',
  faltou: 'faltou',
  confirmar: 'registrar o comparecimento',
}

/**
 * O evento da perícia na agenda (Figma 2164:513, 2164:653 e 2164:702): quando, cliente, detalhe e passo; "Abrir o
 * processo" e "Remarcar". Remarcar é com o Jurídico administrativo e tem limite (G15). O comparecimento é da GGVP-66.
 */
export function DetalhePericia({ evento, aoFechar }: { evento: EventoDaAgenda; aoFechar: () => void }) {
  const janela = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  const categoria = CATEGORIAS_DA_AGENDA.find((c) => c.id === evento.categoria)?.nome
  const instancia = evento.passo?.startsWith('DP.04') ? NOMES_DA_INSTANCIA.juizo : NOMES_DA_INSTANCIA.inss
  const processo = `/casos/${evento.processoId}/pericia`
  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="pericia-titulo" onClose={aoFechar}>
      <div className={styles.cabeca}>
        <div className={styles.textos}>
          <h2 id="pericia-titulo" className={styles.titulo}>
            <strong>{evento.titulo}</strong> · {evento.oQue}
          </h2>
          <p className={styles.chips}>
            <span className={`${styles.categoria} ${cat[evento.categoria]}`}>● {categoria}</span>
            {evento.passo && <span className={styles.passo}>{evento.passo.split(' ')[0]}</span>}
            <span className={styles.estado} data-estado={evento.estado}>
              {ESTADO[evento.estado]}
            </span>
          </p>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>
      <dl className={styles.dados}>
        <dt>Quando</dt>
        <dd>
          {dataLonga(evento.data)} · {evento.hora}
        </dd>
        <dt>Cliente</dt>
        <dd>
          <a href={`/clientes/${evento.fichaId}`}>{evento.titulo}</a>
        </dd>
        <dt>Detalhe</dt>
        <dd>
          {instancia} · {evento.local} · cliente · o Jurídico administrativo acompanha a preparação
        </dd>
        <dt>Passo do BPMN</dt>
        <dd>{evento.passo}</dd>
      </dl>
      <div className={styles.botoes}>
        <a className={styles.primario} href={processo}>
          Abrir o processo
        </a>
        {/* O comparecimento (DP.07) é da GGVP-66. */}
        <button type="button" className={styles.botao} aria-disabled="true">
          Marcar como realizado
        </button>
        <a className={styles.botao} href={`/casos/${evento.processoId}/pericia/marcar?remarcar=1`}>
          Remarcar
        </a>
      </div>
      <p className={styles.nota}>Remarcar a perícia é com o Jurídico administrativo. Remarcação tem limite (G15): passou dele, sobe para a advogada.</p>
    </dialog>
  )
}
