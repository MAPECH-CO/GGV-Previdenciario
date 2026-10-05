import { useEffect, useId, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoCofre } from '../componentes/CampoCofre.tsx'
import { Transcricoes } from '../componentes/Transcricoes.tsx'
import { formatarTelefone } from '../campos.ts'
import { nomeBeneficio } from '../dados/catalogos.ts'
import {
  encerrarGravacao,
  enviarAudioGuardado,
  falasAoVivo,
  iniciarGravacao,
  obterEntrevista,
  registrarAcao,
  registrarSemAudio,
  transcrever,
} from '../dados/entrevista.ts'
import type { Entrevista, Gravacao, InformacaoExtraida, RespostaDoEncerramento, SenhaGov, TarefaEncaminhada } from '../dados/tipos.ts'
import { hora } from '../regras/datas.ts'
import { minutos, pendenciasDaEntrevista, relogio, roteiroDaEntrevista, situacaoDaInformacao } from '../regras/entrevista.ts'
import { situacaoDaSenha } from '../regras/fichaAtendimento.ts'
import { agora } from '../dados/servidor.ts'
import { hojeIso } from '../regras/datas.ts'
import base from './Balcao.module.css'
import styles from './EntrevistaAoVivo.module.css'

// Figma: "Atendimento · Reunião com transcrição" (73:560), com o roteiro do Overlay · Entrevista (1581:348). Gravação
// simulada: o relógio corre e a IA "ouve" a conversa de exemplo. `simular` abre as falhas (CA8 e GGVP-46, CA3); `passo`
// é quantos milissegundos dura um segundo de gravação (o teste acelera).

type Props = { agendamentoId: string; simular?: string; passo?: number }

/** Quando o microfone simulado falha, com `?simular=falha-do-microfone`. */
const FALHA_AOS = 40

const ROTULO_DA_SITUACAO = { confirmado: 'confirmado', detectado: 'detectado', pedir: 'pedir', cofre: 'cofre' }

function valorFalado(info: InformacaoExtraida): string {
  return info.campo === 'telefone' ? formatarTelefone(info.valor) : info.valor
}

export function EntrevistaAoVivo({ agendamentoId, simular, passo = 1000 }: Props) {
  const idAvisei = useId()
  const idNotas = useId()
  const [dados, setDados] = useState<Entrevista | null | undefined>(undefined)
  const [g, setG] = useState<Gravacao | undefined>(undefined)
  const [segundos, setSegundos] = useState(0)
  const [lembrete, setLembrete] = useState(false)
  const [avisei, setAvisei] = useState(false)
  const [cofre, setCofre] = useState(false)
  const [recarregou, setRecarregou] = useState(false)
  const [semAudio, setSemAudio] = useState(false)
  const [notas, setNotas] = useState('')
  const [tarefa, setTarefa] = useState<TarefaEncaminhada | undefined>(undefined)
  const [transcricoes, setTranscricoes] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const pedindo = useRef(false)
  const falhouMicrofone = useRef(false)
  const falhouTranscricao = useRef(false)

  useEffect(() => {
    let valendo = true
    obterEntrevista(agendamentoId).then(async (d) => {
      if (!valendo) return
      let gravacao = d?.gravacao
      // A página recarregou no meio: a gravação volta pausada no último ponto guardado.
      if (gravacao?.estado === 'gravando') {
        gravacao = await registrarAcao(gravacao.id, 'pausou', gravacao.duracao)
        if (!valendo) return
        setRecarregou(true)
      }
      setDados(d)
      setG(gravacao)
      setSegundos(gravacao?.duracao ?? 0)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId])

  useEffect(() => {
    const mudou = () => setOnline(navigator.onLine)
    window.addEventListener('online', mudou)
    window.addEventListener('offline', mudou)
    return () => {
      window.removeEventListener('online', mudou)
      window.removeEventListener('offline', mudou)
    }
  }, [])

  const gravando = g?.estado === 'gravando'
  useEffect(() => {
    if (!gravando) return
    const relogioDaGravacao = setInterval(() => setSegundos((s) => s + 1), passo)
    return () => clearInterval(relogioDaGravacao)
  }, [gravando, passo])

  async function fazer(acao: () => Promise<Gravacao | RespostaDoEncerramento>) {
    if (travado.current) return
    travado.current = true
    setOcupado(true)
    setErro('')
    try {
      const r = await acao()
      if ('gravacao' in r) {
        setG(r.gravacao)
        if (r.tarefa) setTarefa(r.tarefa)
      } else setG(r)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  // O microfone simulado falha no meio (CA8).
  useEffect(() => {
    if (simular !== 'falha-do-microfone' || !g || !gravando || segundos < FALHA_AOS || falhouMicrofone.current) return
    falhouMicrofone.current = true
    fazer(() => registrarAcao(g.id, 'falhou', segundos))
  })

  // Encerrada: o áudio vai para a transcrição; sem internet, espera a conexão voltar e sobe uma vez só (CA5, CA12).
  useEffect(() => {
    if (!g || g.estado !== 'encerrada' || pedindo.current) return
    const precisa = g.transcricao === 'transcrevendo' || (g.transcricao === 'aguardando-internet' && online)
    if (!precisa) return
    pedindo.current = true
    const falhar = simular === 'falha-da-transcricao' && !falhouTranscricao.current
    falhouTranscricao.current ||= falhar
    ;(async () => {
      try {
        const enviada = g.transcricao === 'aguardando-internet' ? await enviarAudioGuardado(g.id) : g
        setG(await transcrever(enviada.id, { falhar }))
      } finally {
        pedindo.current = false
      }
    })()
  }, [g, online, simular])

  if (!dados) {
    return (
      <main className={styles.vazia}>
        <title>Entrevista · GGV Previdenciário</title>
        <h1 className={base.titulo}>{dados === null ? 'Entrevista não encontrada' : 'Abrindo a entrevista…'}</h1>
        {dados === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, agendamento: a } = dados
  const encerrada = g?.estado === 'encerrada'
  const ditas = g ? falasAoVivo(dados).filter((f) => f.aos <= segundos) : []
  const trechos = encerrada && g.transcricao === 'pronta' ? g.trechos : ditas
  const extraidas = encerrada && g.transcricao === 'pronta' ? g.extraidas : ditas.flatMap((f) => f.extrai ?? [])
  const respondidos = new Set(ditas.flatMap((f) => f.roteiro ?? []))
  const aviso = g?.avisoEm ? ` · aviso de gravação feito às ${hora(g.avisoEm)} (G10)` : ''
  const beneficio = nomeBeneficio(ficha.beneficioInteresse)

  const situacao = !g
    ? 'Antes de gravar · avise o cliente (G10)'
    : g.estado === 'gravando'
      ? `● Gravando · ${relogio(segundos)}${aviso}`
      : g.estado === 'pausada'
        ? cofre
          ? `❚❚ Pausada para a senha do gov.br · ${relogio(segundos)} · nada entra no áudio (G9)`
          : `❚❚ Pausada · ${relogio(segundos)}${aviso}`
        : g.estado === 'falhou'
          ? `⚠ A gravação falhou · ${relogio(g.duracao)}`
          : `Encerrada · ${relogio(g.duracao)}${aviso}`

  function aoMudarSenha(senhaGov: SenhaGov) {
    setDados({ ...dados!, ficha: { ...ficha, senhaGov } })
    if (senhaGov.situacao === 'no-cofre' && g) {
      setCofre(false)
      fazer(() => registrarAcao(g.id, 'guardou-senha', segundos))
    }
  }

  return (
    <>
      <title>{`Entrevista com ${ficha.nome} · GGV Previdenciário`}</title>
      <header className={styles.topo}>
        <a className={styles.sair} href={`/entrevista/${a.id}`}>
          ‹&nbsp; Sair
        </a>
        <nav className={styles.nav} aria-label="Principal">
          <a className={styles.item} href="/advogada">
            <span aria-hidden="true">⌂ </span>Início
          </a>
          <a className={styles.item} href="/agenda">
            <span aria-hidden="true">▦ </span>Agenda
          </a>
        </nav>
        <div className={styles.titulos}>
          <h1 className={styles.titulo}>
            Entrevista com <span className={styles.nome}>{ficha.nome}</span>
          </h1>
          <p className={styles.linhaDeEstado}>
            <span className={styles.estado} data-estado={g?.estado ?? 'antes'} role="status">
              {situacao}
            </span>
            <span className={styles.chipAcento}>D1.09 · entrevista gravada</span>
            <span className={styles.chipNeutro}>
              {g?.canal ?? 'presencial'} · {a.com ?? 'Advogada'} + você
            </span>
          </p>
        </div>
        <div className={styles.botoes}>
          {!g && (
            <button type="button" className={styles.primario} onClick={() => setLembrete(true)}>
              Gravar
            </button>
          )}
          {g?.estado === 'gravando' && (
            <button type="button" className={styles.secundario} disabled={ocupado} onClick={() => fazer(() => registrarAcao(g.id, 'pausou', segundos))}>
              Pausar
            </button>
          )}
          {g?.estado === 'pausada' && !cofre && (
            <button
              type="button"
              className={styles.secundario}
              disabled={ocupado}
              onClick={() => {
                setRecarregou(false)
                fazer(() => registrarAcao(g.id, 'retomou', segundos))
              }}
            >
              Retomar
            </button>
          )}
          {(g?.estado === 'gravando' || (g?.estado === 'pausada' && !cofre)) && (
            <button type="button" className={styles.primario} disabled={ocupado} onClick={() => fazer(() => encerrarGravacao(g.id, { aos: segundos, online }))}>
              Encerrar e gerar resumo
            </button>
          )}
        </div>
      </header>

      <main className={styles.pagina}>
        <div className={styles.principal}>
          {lembrete && !g && (
            <section className={styles.lembrete} aria-labelledby="aviso-de-gravacao">
              <h2 id="aviso-de-gravacao" className={styles.cartaoTitulo}>
                Antes de gravar, avise o cliente (G10)
              </h2>
              <p>Diga, com estas palavras ou parecidas:</p>
              <blockquote className={styles.frase}>
                “{ficha.nome.split(' ')[0]}, esta conversa vai ser gravada e transcrita para preencher a sua ficha. Tudo bem?”
              </blockquote>
              <label className={styles.conferencia} htmlFor={idAvisei}>
                <input id={idAvisei} type="checkbox" checked={avisei} onChange={(e) => setAvisei(e.target.checked)} />
                Avisei o cliente que a conversa será gravada
              </label>
              <div className={styles.acoes}>
                <button type="button" className={styles.primario} disabled={!avisei || ocupado} onClick={() => fazer(() => iniciarGravacao(a.id, { avisei: true }))}>
                  {ocupado ? 'começando…' : 'Começar a gravar'}
                </button>
                <button type="button" className={styles.secundario} onClick={() => setLembrete(false)}>
                  Cancelar
                </button>
              </div>
              <p className={base.nota}>A gravação só começa depois do aviso; o portal guarda a hora do aviso.</p>
            </section>
          )}

          {!online && !encerrada && g && (
            <p className={styles.alerta} role="alert">
              Sem internet: a gravação continua e o áudio fica guardado neste computador. Nenhum áudio se perde.
            </p>
          )}
          {recarregou && g?.estado === 'pausada' && (
            <p className={styles.alerta}>A página recarregou: a gravação ficou pausada em {relogio(segundos)}. Retome quando quiser.</p>
          )}
          {erro && (
            <p className={styles.alerta} role="alert">
              {erro}
            </p>
          )}

          {g?.estado === 'falhou' && (
            <section className={styles.falha} role="alert" aria-labelledby="falhou">
              <h2 id="falhou" className={styles.cartaoTitulo}>
                A gravação falhou em {relogio(g.duracao)}
              </h2>
              <p>O que foi gravado até aqui está guardado no caso. Tente gravar de novo ou registre a entrevista sem áudio.</p>
              {semAudio ? (
                <div className={styles.campos}>
                  <label className={styles.rotulo} htmlFor={idNotas}>
                    O que foi conversado *
                  </label>
                  <textarea id={idNotas} className={styles.texto} rows={4} maxLength={4000} value={notas} onChange={(e) => setNotas(e.target.value)} />
                  <button type="button" className={styles.primario} disabled={notas.trim().length < 3 || ocupado} onClick={() => fazer(() => registrarSemAudio(g.id, notas))}>
                    Registrar sem áudio
                  </button>
                </div>
              ) : (
                <div className={styles.acoes}>
                  <button type="button" className={styles.primario} disabled={ocupado} onClick={() => fazer(() => registrarAcao(g.id, 'retomou', g.duracao))}>
                    Tentar gravar de novo
                  </button>
                  <button type="button" className={styles.secundario} onClick={() => setSemAudio(true)}>
                    Registrar como sem áudio
                  </button>
                </div>
              )}
            </section>
          )}

          {encerrada && (
            <section className={base.feito} aria-labelledby="encerrada">
              <h2 id="encerrada" className={base.feitoTitulo}>
                {g.transcricao === 'sem-audio' ? '✓ Entrevista registrada sem áudio' : `✓ Entrevista encerrada · ${minutos(g.duracao)}`}
              </h2>
              {g.audio && <p>O áudio ficou guardado no caso, para sempre: {g.audio.nome}.</p>}
              <p role="status">
                {g.transcricao === 'transcrevendo' && 'Transcrevendo (D1.11)…'}
                {g.transcricao === 'aguardando-internet' &&
                  (online ? 'A internet voltou: enviando o áudio para a transcrição…' : 'Sem internet: o áudio está guardado neste computador e vai para a transcrição quando a conexão voltar.')}
                {g.transcricao === 'pronta' && 'Transcrição pronta (D1.11): o resumo e as informações estão no caso, para conferir.'}
                {g.transcricao === 'falhou' && `A transcrição falhou: ${g.motivoDaFalha}.`}
                {g.transcricao === 'sem-audio' && 'A anotação ficou no caso.'}
              </p>
              <div className={base.atalhos}>
                {g.transcricao === 'falhou' && (
                  <button type="button" className={base.atalho} onClick={() => fazer(() => transcrever(g.id))}>
                    Tentar de novo
                  </button>
                )}
                {g.transcricao !== 'falhou' && (
                  <button type="button" className={base.atalho} onClick={() => setTranscricoes(true)}>
                    Ver a transcrição
                  </button>
                )}
                {(tarefa || ficha.situacao === 'lead') && (
                  <a className={base.atalho} href={`/clientes/${ficha.id}/cadastro`}>
                    Cadastrar lead (D1.10)
                  </a>
                )}
              </div>
            </section>
          )}

          <section className={styles.cartao} aria-labelledby="ao-vivo">
            <h2 id="ao-vivo" className={styles.cartaoTitulo}>
              {encerrada ? 'Transcrição' : 'Transcrição ao vivo'}
            </h2>
            {trechos.length === 0 ? (
              <p className={styles.vazio}>A transcrição aparece aqui quando a gravação começar.</p>
            ) : (
              <ol className={styles.falas} aria-label="Falas">
                {trechos.map((t) => (
                  <li key={t.aos} className={styles.fala}>
                    <span className={styles.quando}>{relogio(t.aos).slice(3)}</span>
                    <span className={styles.quem} data-papel={t.papel}>
                      {t.quem}
                    </span>
                    <span>{t.texto}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className={styles.ia}>
              <span aria-hidden="true">✦ </span>
              A IA está ouvindo: {beneficio ? `o cliente procura ${beneficio}; ` : ''}quem decide o benefício é a advogada (G3). Senha do
              gov.br não entra na transcrição: vai ao cofre (G9).
            </p>
          </section>
        </div>

        <div className={styles.lado}>
          <section className={styles.cartao} aria-labelledby="ficha-pela-ia">
            <h2 id="ficha-pela-ia" className={styles.cartaoTitulo}>
              Ficha preenchida pela IA · você confere
            </h2>
            {extraidas.length === 0 ? (
              <p className={styles.vazio}>Nada ainda: a IA preenche enquanto vocês conversam.</p>
            ) : (
              <dl className={styles.linhas}>
                {extraidas.map((e) => {
                  const s = situacaoDaInformacao(e, ficha)
                  return (
                    <div key={e.id} className={styles.linha}>
                      <dt>{e.rotulo}</dt>
                      <dd>{valorFalado(e)}</dd>
                      <dd className={styles.selo} data-situacao={s}>
                        {ROTULO_DA_SITUACAO[s]}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </section>

          <section className={styles.cartao} aria-labelledby="senha">
            <h2 id="senha" className={styles.cartaoTitulo}>
              Senha do gov.br
            </h2>
            <p className={styles.vazio}>gov.br: {situacaoDaSenha(ficha.senhaGov, hojeIso(agora()))}</p>
            {cofre && g ? (
              <>
                <CampoCofre fichaId={ficha.id} senhaGov={ficha.senhaGov} aoMudar={aoMudarSenha} />
                <button
                  type="button"
                  className={styles.secundario}
                  onClick={() => {
                    setCofre(false)
                    fazer(() => registrarAcao(g.id, 'retomou', segundos))
                  }}
                >
                  Fechar o cofre e retomar
                </button>
              </>
            ) : (
              g?.estado === 'gravando' && (
                <button
                  type="button"
                  className={styles.secundario}
                  disabled={ocupado}
                  onClick={() => {
                    setCofre(true)
                    fazer(() => registrarAcao(g.id, 'abriu-cofre', segundos))
                  }}
                >
                  🔒 Abrir o cofre (pausa a gravação)
                </button>
              )
            )}
            <p className={base.nota}>O cliente digita a senha no cofre; ela não é dita em voz alta e o trecho não entra no áudio (G9).</p>
          </section>

          <section className={styles.cartao} aria-labelledby="roteiro">
            <h2 id="roteiro" className={styles.cartaoTitulo}>
              Roteiro da entrevista (a IA marca o que for respondido)
            </h2>
            <ul className={styles.lista}>
              {roteiroDaEntrevista(ficha).map((item, i) => (
                <li key={item} data-feito={respondidos.has(i)}>
                  <span aria-hidden="true">{respondidos.has(i) ? '✓ ' : '• '}</span>
                  {item}
                  {respondidos.has(i) && <span className="so-leitor"> (respondido)</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.cartao} aria-labelledby="pendencias">
            <h2 id="pendencias" className={styles.cartaoTitulo}>
              Pendências que a IA apontou
            </h2>
            <ul className={styles.lista}>
              {pendenciasDaEntrevista(ficha, extraidas).map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </section>

          <section className={styles.cartao} aria-labelledby="ao-encerrar">
            <h2 id="ao-encerrar" className={styles.cartaoTitulo}>
              Ao encerrar
            </h2>
            <p className={styles.vazio}>
              A transcrição fica no caso (D1.11). A advogada cadastra o lead (D1.10) e define o benefício com a recomendação da IA,
              conferindo antes de finalizar (D1.12).
            </p>
            {encerrada ? (
              <a className={styles.primario} href={`/entrevista/${a.id}/beneficio`}>
                Definir o benefício (D1.12)
              </a>
            ) : (
              <button type="button" className={styles.secundario} disabled>
                Definir o benefício (D1.12) · libera ao encerrar a entrevista
              </button>
            )}
          </section>
        </div>
      </main>
      <AbaSuporte />
      {transcricoes && g && <Transcricoes ficha={ficha} perfil="juridico" inicial={g.id} aoFechar={() => setTranscricoes(false)} />}
    </>
  )
}
