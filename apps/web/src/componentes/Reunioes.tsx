import type { Agendamento } from '../dados/tipos.ts'
import { emAberto } from '../regras/busca.ts'
import { dataCurta } from '../regras/datas.ts'
import { usePode } from '../sessao.ts'
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

/** "Reuniões" (Figma 73:366): a próxima e o botão de marcar a reunião com transcrição. */
export function Reunioes({ fichaId, agendamentos, hoje }: { fichaId: string; agendamentos: Agendamento[]; hoje: string }) {
  // GGVP-123 CA10 (Pedro, 14/10): o botão leva à marcação, a mesma do "Marcar entrevista" (no Figma, "Marcar reunião"), com
  // a opção de gravar e transcrever; só para quem marca. Iniciar na hora segue em "Iniciar conversa" e na tela da entrevista.
  const marca = usePode('ficha.editar')
  return (
    <Cartao titulo="Reuniões">
      <p className={styles.proxima}>{proximaReuniao(agendamentos, hoje)}</p>
      {marca && (
        <a className={styles.botao} href={`/agenda/marcar/${fichaId}`}>
          Marcar reunião (com transcrição)
        </a>
      )}
    </Cartao>
  )
}
