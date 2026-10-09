import { TIPOS_DE_ENTREVISTA } from '../dados/catalogos.ts'
import type { EventoDaAgenda } from '../dados/tipos.ts'
import { diaCurto } from '../regras/agenda.ts'
import { Cartao } from './Cartao.tsx'
import { ListaDatada } from './ListaDatada.tsx'

/** "Próximas reuniões" da tela de marcar (Figma 73:537): as três próximas da agenda. */
export function ProximasReunioes({ eventos, hoje }: { eventos: EventoDaAgenda[]; hoje: string }) {
  const proximas = eventos.filter((e) => e.estado === 'agendado' && e.data >= hoje).slice(0, 3)
  return (
    <Cartao titulo="Próximas reuniões">
      <ListaDatada
        nome="Próximas reuniões"
        vazio="Nenhuma reunião marcada."
        itens={proximas.map((e) => ({
          chave: e.id,
          quando: `${e.data === hoje ? 'hoje' : diaCurto(e.data)} · ${e.hora}`,
          rotulo: e.titulo,
          texto: [e.oQue === 'Fazer entrevista' ? 'Entrevista' : e.oQue, TIPOS_DE_ENTREVISTA.find((t) => t.id === e.tipo)?.nome.toLowerCase(), e.responsavel]
            .filter(Boolean)
            .join(' · '),
        }))}
      />
    </Cartao>
  )
}
