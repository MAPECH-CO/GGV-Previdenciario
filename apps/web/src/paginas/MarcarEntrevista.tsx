import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { Campo } from '../componentes/Campo.tsx'
import { Cartao } from '../componentes/Cartao.tsx'
import { ConviteChatwoot } from '../componentes/ConviteChatwoot.tsx'
import { GrupoDeOpcoes } from '../componentes/GrupoDeOpcoes.tsx'
import { OpcoesDaMarcacao, type Opcoes } from '../componentes/OpcoesDaMarcacao.tsx'
import { ProximasReunioes } from '../componentes/ProximasReunioes.tsx'
import { TopoFicha } from '../componentes/TopoFicha.tsx'
import { eventosDaAgenda, iniciarEntrevistaAgora, marcarEntrevista } from '../dados/agenda.ts'
import { EQUIPE, TIPOS_DE_ENTREVISTA } from '../dados/catalogos.ts'
import { agora, obterFicha } from '../dados/servidor.ts'
import type { Agendamento, EventoDaAgenda, Ficha, TipoDeEntrevista } from '../dados/tipos.ts'
import {
  DURACOES,
  HORARIOS,
  LIMITE_DE_REMARCACOES,
  diaCheio,
  diaCurto,
  equipeDaEntrevista,
  mensagemDoConvite,
  podeRemarcar,
  proximosDiasUteis,
  somarDias,
} from '../regras/agenda.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import styles from './MarcarEntrevista.module.css'

// Figma: "Atendimento · Marcar reunião" (73:459). Passo D1.03 do Miro. Com `remarcar`, o motivo é obrigatório (CA7).

const COM_QUEM = equipeDaEntrevista(EQUIPE).map((m) => ({ id: m.id, nome: `${m.nome} (advogada) + você` }))
const nomeDoTipo = (id: string | undefined) => TIPOS_DE_ENTREVISTA.find((t) => t.id === id)?.nome ?? ''

type Props = { fichaId: string; remarcar?: string; navegar?: (url: string) => void }

export function MarcarEntrevista({ fichaId, remarcar, navegar = (url) => window.location.assign(url) }: Props) {
  const hoje = hojeIso(agora())
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  const [eventos, setEventos] = useState<EventoDaAgenda[]>([])
  const [tipo, setTipo] = useState<TipoDeEntrevista>('video')
  const [data, setData] = useState<string | null>(null)
  const [hora, setHora] = useState<string | null>(null)
  const [duracao, setDuracao] = useState('45')
  const [com, setCom] = useState(COM_QUEM[0]?.id ?? '')
  const [opcoes, setOpcoes] = useState<Opcoes>({ convite: true, gravar: true, pedirFicha: true, levar: true })
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState<EventoDaAgenda[]>([])
  const [salvando, setSalvando] = useState(false)
  const [feito, setFeito] = useState<Agendamento | null>(null)
  const [convite, setConvite] = useState<'fechado' | 'aberto' | 'enviado'>('fechado')
  const [erro, setErro] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    Promise.all([obterFicha(fichaId), eventosDaAgenda(hoje, somarDias(hoje, 60))]).then(([f, e]) => {
      if (!valendo) return
      setFicha(f)
      setEventos(e)
      const antes = f?.agendamentos.find((a) => a.id === remarcar)
      if (antes?.tipo) setTipo(antes.tipo)
      if (antes?.duracao) setDuracao(String(antes.duracao))
    })
    return () => {
      valendo = false
    }
  }, [fichaId, remarcar, hoje])

  if (!ficha) {
    return (
      <main className={styles.vazia}>
        <title>Marcar a entrevista · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{ficha === null ? 'Ficha não encontrada' : 'Abrindo…'}</h1>
        {ficha === null && <a href="/balcao">Voltar ao balcão</a>}
      </main>
    )
  }

  const antes = ficha.agendamentos.find((a) => a.id === remarcar)
  const noLimite = antes !== undefined && !podeRemarcar(antes.remarcacoes ?? 0)
  const motivoParado = noLimite
    ? `Já são ${LIMITE_DE_REMARCACOES} remarcações: o caso sobe para a advogada sênior (G15).`
    : !data
      ? 'Escolha o dia.'
      : !hora
        ? 'Escolha o horário.'
        : antes && motivo.trim().length < 3
          ? 'Escreva o motivo da remarcação.'
          : null
  const previa =
    data && hora
      ? mensagemDoConvite({ nome: ficha.nome, tipo, data, hora, link: 'meet.google.com/ggv-…', ...opcoes })
      : 'Escolha o dia e o horário para ver o convite.'

  async function marcar(confirmarHorarioOcupado: boolean) {
    if (travado.current || motivoParado || !data || !hora) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const resposta = await marcarEntrevista(ficha!.id, {
        tipo,
        data,
        hora,
        duracao: Number(duracao),
        com,
        gravar: opcoes.gravar,
        levar: opcoes.levar,
        pedirFicha: opcoes.pedirFicha,
        confirmarHorarioOcupado,
        remarcar: antes ? { agendamentoId: antes.id, motivo } : undefined,
      })
      if (resposta.resultado === 'ocupado') return setOcupado(resposta.conflitos)
      if (resposta.resultado === 'limite') return setErro(`Já são ${LIMITE_DE_REMARCACOES} remarcações: o caso sobe para a advogada sênior (G15).`)
      setOcupado([])
      setFeito(resposta.agendamento)
      if (opcoes.convite) setConvite('aberto')
    } catch {
      setErro('Não deu para marcar. Confira as escolhas e tente de novo.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  /** A pessoa já está aqui: a entrevista começa agora, sem convite, e a tela da entrevista abre (GGVP-40). */
  async function iniciarAgora() {
    if (travado.current) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const agendamento = await iniciarEntrevistaAgora(ficha!.id, { tipo, com, duracao: Number(duracao), gravar: opcoes.gravar })
      navegar(`/entrevista/${encodeURIComponent(agendamento.id)}`)
    } catch {
      setErro('Não deu para iniciar a entrevista. Confira o tipo e com quem.')
      travado.current = false
      setSalvando(false)
    }
  }

  return (
    <>
      <title>{`Marcar a entrevista · ${ficha.nome} · GGV Previdenciário`}</title>
      <TopoFicha
        voltar
        titulo={`${antes ? 'Remarcar' : 'Marcar'} a entrevista com ${ficha.nome}`}
        chips={[
          { texto: 'D1.03 · encaminhar / agendar', tom: 'acento' },
          { texto: ficha.situacao === 'lead' ? 'cliente novo' : 'cliente', tom: 'neutro' },
        ]}
      />
      <main className={styles.pagina}>
        <div className={styles.esquerda}>
          {feito ? (
            <section className={styles.feito} aria-labelledby="marcada">
              <h2 id="marcada" className={styles.feitoTitulo}>
                ✓ Entrevista {antes ? 'remarcada' : 'marcada'} para {diaCurto(feito.data)}/{feito.data.slice(5, 7)} às {feito.hora} ·{' '}
                {nomeDoTipo(feito.tipo).toLowerCase()} · {feito.com}
              </h2>
              <p>
                Está na agenda e no histórico da ficha.{' '}
                {convite === 'enviado' ? 'O convite foi enviado pelo Chatwoot e ficou em "Últimos contatos".' : 'O convite ainda não foi enviado.'}
              </p>
              <div className={styles.botoes}>
                {convite !== 'enviado' && (
                  <button type="button" className={styles.secundario} onClick={() => setConvite('aberto')}>
                    Enviar convite
                  </button>
                )}
                <a className={styles.secundario} href="/agenda">
                  Ver na agenda
                </a>
                <a className={styles.secundario} href={`/clientes/${ficha.id}`}>
                  Abrir a ficha
                </a>
              </div>
            </section>
          ) : (
            <Cartao titulo="Quando e como">
              {antes && (
                <p className={styles.antes}>
                  Antes: {dataCurta(antes.data, hoje)} às {antes.hora} · {antes.remarcacoes ?? 0} de {LIMITE_DE_REMARCACOES} remarcações
                </p>
              )}
              <GrupoDeOpcoes
                rotulo="Tipo"
                opcoes={TIPOS_DE_ENTREVISTA.map((t) => ({ id: t.id, rotulo: t.nome }))}
                valor={tipo}
                aoMudar={(id) => setTipo(id as TipoDeEntrevista)}
              />
              <GrupoDeOpcoes
                rotulo="Data"
                forma="dia"
                opcoes={proximosDiasUteis(hoje).map((d) => {
                  const cheio = diaCheio(eventos, d)
                  return { id: d, rotulo: diaCurto(d), sub: cheio ? 'cheio' : 'livre', alerta: cheio }
                })}
                valor={data}
                aoMudar={(d) => {
                  setData(d)
                  setOcupado([])
                }}
              />
              <GrupoDeOpcoes
                rotulo="Horário"
                opcoes={HORARIOS.map((h) => ({ id: h, rotulo: h }))}
                valor={hora}
                aoMudar={(h) => {
                  setHora(h)
                  setOcupado([])
                }}
              />
              <div className={styles.linha}>
                <Campo id="marcar-com" rotulo="Com quem" valor={com} aoMudar={setCom} opcoes={COM_QUEM} />
                <Campo
                  id="marcar-duracao"
                  rotulo="Duração"
                  valor={duracao}
                  aoMudar={setDuracao}
                  opcoes={DURACOES.map((d) => ({ id: String(d), nome: `${d} min` }))}
                />
              </div>
              {antes && (
                <div className={styles.linha}>
                  <Campo id="marcar-motivo" rotulo="Motivo da remarcação *" valor={motivo} aoMudar={setMotivo} maxLength={300} largo />
                </div>
              )}
              <OpcoesDaMarcacao valor={opcoes} aoMudar={setOpcoes} />
              {ocupado.length > 0 && (
                <div className={styles.ocupado} role="alert">
                  <p>
                    Este horário já tem{' '}
                    {ocupado.map((e) => `${e.titulo} · ${e.oQue.toLowerCase()} às ${e.hora}${e.responsavel ? ` com ${e.responsavel}` : ''}`).join('; ')}. O
                    escritório tem duas salas: dá para marcar mesmo assim.
                  </p>
                  <button type="button" className={styles.secundario} disabled={salvando} onClick={() => marcar(true)}>
                    Marcar mesmo assim
                  </button>
                </div>
              )}
              <div className={styles.botoes}>
                <button type="button" className={styles.primario} disabled={motivoParado !== null || salvando} onClick={() => marcar(false)}>
                  {salvando ? 'marcando…' : opcoes.convite ? 'Marcar e enviar convite' : 'Marcar'}
                </button>
                {!antes && (
                  <button type="button" className={styles.secundario} disabled={salvando} onClick={iniciarAgora}>
                    Iniciar entrevista (Transcrição)
                  </button>
                )}
              </div>
              {(motivoParado || erro) && <p className={styles.motivo}>{erro || motivoParado}</p>}
            </Cartao>
          )}
        </div>
        <div className={styles.direita}>
          <ProximasReunioes eventos={eventos} hoje={hoje} />
          <Cartao titulo="Convite (prévia)">
            <p className={styles.previa}>{previa}</p>
          </Cartao>
        </div>
      </main>
      <AbaSuporte />
      {feito && convite === 'aberto' && (
        <ConviteChatwoot agendamentoId={feito.id} aoEnviado={() => setConvite('enviado')} aoFechar={() => setConvite('fechado')} />
      )}
    </>
  )
}
