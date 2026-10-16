import type { ReactNode } from 'react'
import { CATEGORIAS_DA_AGENDA, TIPOS_DE_ENTREVISTA } from '../dados/catalogos.ts'
import type { EventoDaAgenda } from '../dados/tipos.ts'
import { dataLonga } from '../regras/agenda.ts'
import { semCodigo } from '../regras/texto.ts'
import cat from './Categorias.module.css'
import styles from './CartaoEvento.module.css'
import { Previa } from './Previa.tsx'
import estilo from './Previa.module.css'

const RODAPE: Record<EventoDaAgenda['estado'], string> = { agendado: '', realizado: '✓ realizado', faltou: 'faltou', confirmar: 'confirmar se aconteceu' }
const ESTADO_NA_PREVIA: Record<EventoDaAgenda['estado'], string> = {
  agendado: 'agendado',
  realizado: 'realizado',
  faltou: 'faltou',
  confirmar: 'confirmar se aconteceu',
}


/** O que a prévia do evento mostra. Tudo vem do próprio evento; não há busca. */
export function DetalheDoEvento({ evento: e }: { evento: EventoDaAgenda }) {
  const categoria = CATEGORIAS_DA_AGENDA.find((c) => c.id === e.categoria)?.nome
  const tipo = TIPOS_DE_ENTREVISTA.find((t) => t.id === e.tipo)?.nome
  return (
    <>
      <p className={estilo.linha}>
        {dataLonga(e.data)} · {e.hora}
        {e.duracao ? ` · ${e.duracao} min` : ''}
      </p>
      <p className={estilo.linha}>{e.oQue}</p>
      <p className={estilo.linha}>{categoria}</p>
      {tipo && <p className={estilo.linha}>{tipo}</p>}
      {e.responsavel && <p className={estilo.linha}>Responsável: {e.responsavel}</p>}
      {e.passo && <p className={estilo.linha}>{semCodigo(e.passo)}</p>}
      <p className={`${estilo.linha} ${estilo.destaque}`}>{ESTADO_NA_PREVIA[e.estado]}</p>
    </>
  )
}

/** Qualquer item de evento da agenda, com a prévia dele ao passar o mouse ou focar pelo teclado. */
export function ComPreviaDoEvento({ evento, children }: { evento: EventoDaAgenda; children: ReactNode }) {
  return (
    <Previa rotulo={evento.titulo} conteudo={() => <DetalheDoEvento evento={evento} />}>
      {children}
    </Previa>
  )
}

/** Um evento na coluna da semana (Figma 1941:2): hora e categoria, quem, o quê e o estado. */
export function CartaoEvento({ evento, aoAbrir }: { evento: EventoDaAgenda; aoAbrir: () => void }) {
  const categoria = CATEGORIAS_DA_AGENDA.find((c) => c.id === evento.categoria)?.nome.split(' ')[0]
  return (
    <ComPreviaDoEvento evento={evento}>
      <button
        type="button"
        className={`${styles.cartao} ${cat[evento.estado === 'confirmar' ? 'confirmar' : evento.categoria]}`}
        data-estado={evento.estado}
        onClick={aoAbrir}
      >
        <span className={styles.topo}>
          {evento.hora} · {categoria}
        </span>
        <span className={styles.titulo}>{evento.titulo}</span>
        <span className={styles.oQue}>{evento.oQue}</span>
        {RODAPE[evento.estado] && <span className={styles.estado}>{RODAPE[evento.estado]}</span>}
      </button>
    </ComPreviaDoEvento>
  )
}
