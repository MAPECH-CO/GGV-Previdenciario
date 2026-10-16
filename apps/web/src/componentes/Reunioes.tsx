import type { Agendamento } from '../dados/tipos.ts'
import { emAberto } from '../regras/busca.ts'
import { dataCurta } from '../regras/datas.ts'
import { Cartao } from './Cartao.tsx'
import styles from './Reunioes.module.css'

function proximaReuniao(agendamentos: Agendamento[], hoje: string): string {
  const [proxima] = agendamentos
    .filter((a) => a.data >= hoje && emAberto(a))
    .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
  if (!proxima) return 'Próxima: nenhuma marcada.'
  const quando = proxima.data === hoje ? `hoje ${proxima.hora}` : `${dataCurta(proxima.data, hoje)} ${proxima.hora}`
  return `Próxima: ${quando} · ${proxima.oQue}${proxima.com ? ` com ${proxima.com}` : ''}.`
}

/** "Reuniões" (Figma 73:366): a próxima reunião marcada. */
export function Reunioes({ agendamentos, hoje }: { agendamentos: Agendamento[]; hoje: string }) {
  return (
    <Cartao titulo="Reuniões">
      <p className={styles.proxima}>{proximaReuniao(agendamentos, hoje)}</p>
      {/* A reunião com transcrição ainda não existe: o botão desligado parecia ação e não fazia nada. Volta com a história dela. */}
    </Cartao>
  )
}
