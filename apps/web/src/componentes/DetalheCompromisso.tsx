import { useEffect, useRef, useState } from 'react'
import { registrarResultado } from '../dados/agenda.ts'
import { CATEGORIAS_DA_AGENDA } from '../dados/catalogos.ts'
import type { EventoDaAgenda } from '../dados/tipos.ts'
import { LIMITE_DE_REMARCACOES, dataLonga, detalheDoEvento, podeRemarcar } from '../regras/agenda.ts'
import cat from './Categorias.module.css'
import { ConviteChatwoot } from './ConviteChatwoot.tsx'
import styles from './DetalheCompromisso.module.css'

type Props = {
  evento: EventoDaAgenda
  /** Algo mudou: a agenda busca de novo. */
  aoMudar: () => void
  aoFechar: () => void
  navegar: (url: string) => void
}

const ESTADO: Record<EventoDaAgenda['estado'], string> = {
  agendado: 'agendado',
  realizado: 'realizado',
  faltou: 'faltou',
  confirmar: 'confirmar se aconteceu',
}

/** O detalhe do compromisso (Figma 2164:280): realizado, faltou, remarcar e o convite (CA4, CA6, CA8, CA9). */
export function DetalheCompromisso({ evento, aoMudar, aoFechar, navegar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const [convite, setConvite] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  const remarcar = evento.fichaId ? `/agenda/marcar/${evento.fichaId}?remarcar=${evento.id}` : null
  const aberto = evento.estado === 'agendado' || evento.estado === 'confirmar'

  async function registrar(resultado: 'realizado' | 'faltou') {
    if (travado.current) return
    travado.current = true
    setRegistrando(true)
    setErro('')
    try {
      await registrarResultado(evento.id, resultado)
      // "Faltou" abre o remarcar com motivo (CA8, CA9).
      if (resultado === 'faltou' && remarcar && podeRemarcar(evento.remarcacoes)) return navegar(remarcar)
      aoMudar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setRegistrando(false)
    }
  }

  const categoria = CATEGORIAS_DA_AGENDA.find((c) => c.id === evento.categoria)?.nome
  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="compromisso-titulo" onClose={aoFechar}>
      <div className={styles.cabeca}>
        <div className={styles.textos}>
          <h2 id="compromisso-titulo" className={styles.titulo}>
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
        {evento.fichaId && (
          <>
            <dt>Cliente</dt>
            <dd>
              <a href={`/clientes/${evento.fichaId}`}>{evento.titulo}</a>
            </dd>
          </>
        )}
        <dt>Detalhe</dt>
        <dd>{detalheDoEvento(evento) || '—'}</dd>
        <dt>Passo do BPMN</dt>
        <dd>{evento.passo ?? '—'}</dd>
      </dl>
      {evento.estado === 'confirmar' && <p className={styles.alerta}>Passou sem registro: confirme se aconteceu.</p>}
      <div className={styles.botoes}>
        {evento.fichaId && (
          <a className={styles.primario} href={`/clientes/${evento.fichaId}`}>
            Abrir a ficha
          </a>
        )}
        {aberto && (
          <>
            <button type="button" className={styles.botao} disabled={registrando} onClick={() => registrar('realizado')}>
              Marcar como realizado
            </button>
            <button type="button" className={styles.botao} disabled={registrando} onClick={() => registrar('faltou')}>
              Faltou
            </button>
          </>
        )}
        {remarcar && evento.estado !== 'realizado' && podeRemarcar(evento.remarcacoes) && (
          <a className={styles.botao} href={remarcar}>
            Remarcar
          </a>
        )}
        {evento.fichaId && aberto && evento.oQue === 'Fazer entrevista' && (
          <button type="button" className={styles.botao} onClick={() => setConvite(true)}>
            {evento.conviteEnviadoEm ? 'Enviar o convite de novo' : 'Enviar convite'}
          </button>
        )}
      </div>
      {erro && (
        <p role="alert" className={styles.alerta}>
          {erro}
        </p>
      )}
      <p className={styles.nota}>
        {podeRemarcar(evento.remarcacoes)
          ? `Remarcar manda o novo convite ao cliente. Remarcação tem limite (G15): até ${LIMITE_DE_REMARCACOES}.`
          : `Já são ${LIMITE_DE_REMARCACOES} remarcações: o caso sobe para a advogada sênior (G15).`}
      </p>
      {convite && (
        <ConviteChatwoot
          agendamentoId={evento.id}
          aoEnviado={() => {
            setConvite(false)
            aoMudar()
          }}
          aoFechar={() => setConvite(false)}
        />
      )}
    </dialog>
  )
}
