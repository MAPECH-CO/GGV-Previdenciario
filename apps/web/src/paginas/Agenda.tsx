import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { Abas } from '../componentes/Abas.tsx'
import { AgendaLista } from '../componentes/AgendaLista.tsx'
import { AgendaMes } from '../componentes/AgendaMes.tsx'
import { AgendaSemana } from '../componentes/AgendaSemana.tsx'
import { DetalheCompromisso } from '../componentes/DetalheCompromisso.tsx'
import { DetalhePericia } from '../componentes/DetalhePericia.tsx'
import { FiltrosDaAgenda } from '../componentes/FiltrosDaAgenda.tsx'
import { NovoEvento } from '../componentes/NovoEvento.tsx'
import { Topbar, type ItemNavegacao } from '../componentes/Topbar.tsx'
import { eventosDaAgenda } from '../dados/agenda.ts'
import { CATEGORIAS_DA_AGENDA } from '../dados/catalogos.ts'
import { agora } from '../dados/servidor.ts'
import type { CategoriaDaAgenda, EventoDaAgenda } from '../dados/tipos.ts'
import { gradeDoMes, semanaDe, somarDias } from '../regras/agenda.ts'
import { hojeIso } from '../regras/datas.ts'
import { useSessao } from '../sessao.ts'
import styles from './Agenda.module.css'

// Figma: Agenda · Semana (1941:2), Mês (1941:198) e Lista (1941:401) do Atendimento; detalhe do compromisso (2164:280).

export type Vista = 'semana' | 'mes' | 'lista'

const navegacao: ItemNavegacao[] = [
  { id: 'inicio', rotulo: 'Início', href: '/' },
  { id: 'agenda', rotulo: 'Agenda', href: '/agenda' },
]
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesCurto = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3)
const dataBr = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** O mês ao lado, pelo dia 15, para não pular mês curto. */
function outroMes(iso: string, passo: number): string {
  const total = Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1 + passo
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-15`
}

type Props = { vistaInicial?: Vista; navegar?: (url: string) => void }

export function Agenda({ vistaInicial = 'semana', navegar = (url) => window.location.assign(url) }: Props) {
  const sessao = useSessao()
  const [soMinhas, setSoMinhas] = useState(false)
  const hoje = hojeIso(agora())
  const [vista, setVista] = useState<Vista>(vistaInicial)
  const [ref, setRef] = useState(hoje)
  const [consulta, setConsulta] = useState<{ faixa: string; eventos: EventoDaAgenda[]; erro: string }>({ faixa: '', eventos: [], erro: '' })
  const [ativas, setAtivas] = useState(new Set<CategoriaDaAgenda>(CATEGORIAS_DA_AGENDA.map((c) => c.id)))
  const [aberto, setAberto] = useState<EventoDaAgenda | null>(null)
  const [novo, setNovo] = useState(false)
  const [versao, setVersao] = useState(0)

  const dias = semanaDe(ref)
  const semanas = gradeDoMes(ref)
  const [de, ate] =
    vista === 'semana' ? [dias[0], dias[6]] : vista === 'mes' ? [semanas[0][0], semanas.at(-1)![6]] : [somarDias(hoje, -60), somarDias(ref, 90)]

  const faixa = `${de}|${ate}|${versao}`
  const eventos = consulta.faixa === faixa ? consulta.eventos : []
  const erro = consulta.faixa === faixa ? consulta.erro : ''

  useEffect(() => {
    let valendo = true
    eventosDaAgenda(de, ate).then((lista) => {
      if (valendo) setConsulta({ faixa, eventos: lista, erro: '' })
    }).catch(() => {
      if (valendo) setConsulta({ faixa, eventos: [], erro: 'Não deu para carregar a agenda agora.' })
    })
    return () => {
      valendo = false
    }
  }, [de, ate, faixa])

  const naTela = vista === 'lista' ? eventos.filter((e) => e.estado === 'confirmar' || e.data >= ref) : eventos
  const doResponsavel = naTela.filter((e) => !soMinhas || e.responsavel === sessao?.nome)
  const visiveis = doResponsavel.filter((e) => ativas.has(e.categoria))
  const rotulo =
    vista === 'semana'
      ? `${Number(dias[0].slice(8))}${mesCurto(dias[0]) === mesCurto(dias[6]) ? '' : ` ${mesCurto(dias[0])}`} – ${Number(dias[6].slice(8))} ${mesCurto(dias[6])} de ${dias[6].slice(0, 4)}`
      : vista === 'mes'
        ? `${MESES[Number(ref.slice(5, 7)) - 1].replace(/^./, (l) => l.toUpperCase())} de ${ref.slice(0, 4)}`
        : `A partir de ${ref === hoje ? 'hoje · ' : ''}${dataBr(ref)}`
  const andar = (passo: number) => setRef((r) => (vista === 'mes' ? outroMes(r, passo) : somarDias(r, 7 * passo)))
  const mudou = () => {
    setAberto(null)
    setNovo(false)
    setVersao((v) => v + 1)
  }

  return (
    <>
      <title>Agenda · GGV Previdenciário</title>
      <Topbar itens={navegacao} ativo="agenda" funcao="Atendimento" />
      <main className={styles.pagina}>
        <div className={styles.topo}>
          <div>
            <h1 className={styles.titulo}>Agenda</h1>
            <p className={styles.subtitulo}>
              {vista === 'lista'
                ? 'Tudo o que vem pela frente, em ordem de data. Os prazos aparecem no dia final.'
                : 'Visitas, perícias, audiências, protocolos, prazos, idas ao banco e retornos. Cada evento nasce de uma etapa do processo.'}
            </p>
          </div>
          <button type="button" className={styles.novo} onClick={() => setNovo(true)}>
            + Novo evento
          </button>
        </div>

        <div className={styles.barra}>
          <div className={styles.abas}>
            <Abas
              rotulo="Visões da agenda"
              ativa={vista}
              onMudar={(id) => setVista(id as Vista)}
              abas={[
                { id: 'semana', rotulo: 'Semana' },
                { id: 'mes', rotulo: 'Mês' },
                { id: 'lista', rotulo: 'Lista' },
              ]}
            />
            {/* Protocolos é de outro épico: avisa que está indisponível. */}
            <button type="button" className={styles.protocolos} aria-disabled="true">
              Protocolos
            </button>
          </div>
          <div className={styles.navegacao}>
            <button type="button" className={styles.passo} aria-label="Anterior" onClick={() => andar(-1)}>
              ‹
            </button>
            <button type="button" className={styles.passo} onClick={() => setRef(hoje)}>
              Hoje
            </button>
            <button type="button" className={styles.passo} aria-label="Próximo" onClick={() => andar(1)}>
              ›
            </button>
            <p className={styles.periodo} aria-live="polite">
              {rotulo}
            </p>
          </div>
        </div>

        <label className={styles.nota}>
          <input type="checkbox" checked={soMinhas} disabled={!sessao} onChange={e => setSoMinhas(e.target.checked)} /> Só as minhas
        </label>
        {erro && (
          <p role="alert" className={styles.erro}>
            {erro}{' '}
            <button type="button" className={styles.tentar} onClick={() => setVersao((v) => v + 1)}>
              Tentar de novo
            </button>
          </p>
        )}
        <FiltrosDaAgenda eventos={doResponsavel} ativas={ativas} aoMudar={setAtivas} />

        <section role="tabpanel" id={`painel-${vista}`} aria-labelledby={`aba-${vista}`} className={styles.painel}>
          {vista === 'semana' && <AgendaSemana dias={dias} eventos={visiveis} hoje={hoje} aoAbrir={setAberto} />}
          {vista === 'mes' && <AgendaMes semanas={semanas} mes={ref.slice(0, 7)} eventos={visiveis} hoje={hoje} aoAbrir={setAberto} />}
          {vista === 'lista' && <AgendaLista desde={ref} eventos={visiveis} hoje={hoje} aoAbrir={setAberto} />}
        </section>

        {vista === 'semana' && (
          <p className={styles.nota}>
            Clique num evento para ver o detalhe. O evento nasce da etapa (a entrevista, a perícia, o protocolo) e
            volta para a tarefa quando é realizado. A advogada vê todos os tipos; o Atendimento vê visitas, perícias, bancos, retornos e prazos.
          </p>
        )}
      </main>
      <AbaSuporte />
      {/* A perícia tem o detalhe dela (épico GGVP-10, Figma 2164:513). */}
      {aberto && aberto.categoria === 'pericias' && <DetalhePericia evento={aberto} aoFechar={() => setAberto(null)} />}
      {aberto && aberto.categoria !== 'pericias' && <DetalheCompromisso evento={aberto} aoMudar={mudou} aoFechar={() => setAberto(null)} navegar={navegar} />}
      {novo && <NovoEvento hoje={hoje} aoCriado={mudou} aoFechar={() => setNovo(false)} navegar={navegar} />}
    </>
  )
}
