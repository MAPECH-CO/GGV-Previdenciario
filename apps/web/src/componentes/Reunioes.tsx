import type { Agendamento } from '../dados/tipos.ts'
import { dataCurta } from '../regras/datas.ts'
import { Cartao } from './Cartao.tsx'
import styles from './Reunioes.module.css'

function proximaReuniao(agendamentos: Agendamento[], hoje: string): string {
  const [proxima] = agendamentos
    .filter((a) => a.data >= hoje)
    .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
  if (!proxima) return 'Próxima: nenhuma marcada.'
  const quando = proxima.data === hoje ? `hoje ${proxima.hora}` : `${dataCurta(proxima.data, hoje)} ${proxima.hora}`
  return `Próxima: ${quando} · ${proxima.oQue}${proxima.com ? ` com ${proxima.com}` : ''}.`
}

/** "Reuniões" (Figma 73:366): a próxima e o botão de reunião com transcrição. */
export function Reunioes({ agendamentos, hoje }: { agendamentos: Agendamento[]; hoje: string }) {
  return (
    <Cartao titulo="Reuniões">
      <p className={styles.proxima}>{proximaReuniao(agendamentos, hoje)}</p>
      {/* Reunião com transcrição é de outra história: avisa que está indisponível. */}
      <button type="button" className={styles.botao} aria-disabled="true">
        Marcar e iniciar reunião (com transcrição)
      </button>
    </Cartao>
  )
}
