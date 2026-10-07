import { useEffect, useId, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { HistoricoDeVersoes } from '../componentes/HistoricoDeVersoes.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { Transcricoes } from '../componentes/Transcricoes.tsx'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { conferirConversa, obterConversa, type ConversaAberta } from '../dados/conversa.ts'
import { usePerfil } from '../dados/perfis.ts'
import {
  CANAIS_DO_REGISTRO,
  QUEM_PODE,
  erroDoValor,
  motivoParaNaoConferir,
  papelDoPerfil,
  podeConfirmar,
  valorLido,
  type DecisaoDaMudanca,
  type Mudanca,
} from '../regras/conversa.ts'
import { hora } from '../regras/datas.ts'
import { relogio } from '../regras/entrevista.ts'
import base from './Balcao.module.css'
import proprio from './Conversa.module.css'
import vivo from './EntrevistaAoVivo.module.css'

// Figma step_D5.04 (2282:2): quem fez a conversa confere na hora o que a IA quer mudar, campo por campo, antes de gravar
// (Pedro, 07/10). Depois, "Surgiu pendência?" (GGVP-88) e o caso segue de onde parou.

type Decisoes = Record<string, DecisaoDaMudanca>

const SEM_DECISAO = 'a conferir'

export function ConferirConversa({ conversaId }: { conversaId: string }) {
  const idCorrecao = useId()
  const [dados, setDados] = useState<ConversaAberta | null | undefined>(undefined)
  const [decisoes, setDecisoes] = useState<Decisoes>({})
  const [pendencia, setPendencia] = useState<'nao' | null>(null)
  const [transcricoes, setTranscricoes] = useState(false)
  const [historico, setHistorico] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const perfil = usePerfil(dados?.conversa.papel === 'juridico' ? 'Advogada' : 'Atendimento')

  useEffect(() => {
    let valendo = true
    obterConversa(conversaId).then((d) => {
      if (valendo) setDados(d)
    })
    return () => {
      valendo = false
    }
  }, [conversaId])

  if (!dados) {
    return (
      <main className={vivo.vazia}>
        <title>Conferir conversa · GGV Previdenciário</title>
        <h1 className={base.titulo}>{dados === null ? 'Conversa não encontrada' : 'Abrindo a conversa…'}</h1>
        {dados === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { conversa: c, ficha, gravacao: g } = dados
  const processo = ficha.processos.find((p) => p.id === c.processoId)
  const papel = papelDoPerfil(perfil?.id)
  const juridico = papel === 'juridico'
  const primeira = !c.conferidaEm
  const souQuemConversou = perfil?.usuario === c.quem
  const mudancas = c.analise?.mudancas ?? []
  const jaDecididas = new Map((c.decisoes ?? []).map((d) => [d.id, d]))
  // Na primeira conferência, quem conversou; depois, o Jurídico, no que ficou só para ele (CA8).
  const podeAgir = primeira ? souQuemConversou : juridico && mudancas.some((m) => !jaDecididas.has(m.id))
  const abertas = mudancas.filter((m) => !jaDecididas.has(m.id) && podeConfirmar(m.campo, papel))
  const lista = Object.values(decisoes).filter((d) => abertas.some((m) => m.id === d.id))
  const falasDeSaude = new Set(mudancas.filter((m) => m.saude).map((m) => m.aos))
  const pronta = !g || g.transcricao === 'pronta' || g.transcricao === 'sem-audio'
  const motivoParado = !pronta
    ? 'A transcrição ainda não ficou pronta.'
    : (motivoParaNaoConferir(mudancas, lista, papel, [...jaDecididas.keys()]) ??
      (primeira && pendencia === null ? 'Responda "Surgiu pendência?".' : !primeira && lista.length === 0 ? 'Confira o que ficou para o Jurídico.' : null))
  const ditoAs = (aos: number) =>
    g?.avisoEm ? `dito às ${hora(new Date(Date.parse(g.avisoEm) + aos * 1000).toISOString())}` : `aos ${relogio(aos).slice(3)} do áudio`

  function decidir(m: Mudanca, decisao: DecisaoDaMudanca['decisao']) {
    setDecisoes((d) => ({ ...d, [m.id]: { id: m.id, decisao, ...(decisao === 'corrigida' && { valor: d[m.id]?.valor ?? valorLido(m.campo, m.depois) }) } }))
  }

  async function confirmar() {
    if (travado.current || motivoParado || !perfil) return
    travado.current = true
    setEnviando(true)
    setErro('')
    try {
      setDados(await conferirConversa(c.id, { decisoes: lista, ...(primeira && { pendencia: { surgiu: false as const } }) }, { quem: perfil.usuario, perfil: perfil.id }))
      setDecisoes({})
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para conferir.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  const situacaoDe = (m: Mudanca) => jaDecididas.get(m.id)?.decisao ?? decisoes[m.id]?.decisao

  return (
    <>
      <title>{`${ficha.nome} · Conferir conversa · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Você · ${perfil?.rotulo ?? (c.papel === 'juridico' ? 'Jurídico' : 'Atendimento')}`} inicio={perfil?.inicio} />
      <main className={base.pagina}>
        <div className={base.principal}>
          <div className={base.cabecalho}>
            <div className={base.chips}>
              <span className={base.codigo} title="D5.04 · Conferir o que a IA atualizou (passo do BPMN)">
                D5.04
              </span>
              <span className={proprio.setor}>{c.papel === 'juridico' ? 'Jurídico' : 'Atendimento'}</span>
            </div>
            <h1 className={base.titulo}>
              <strong>{ficha.nome}</strong> · Conferir conversa
            </h1>
            <p className={base.subtitulo}>
              {[
                processo ? nomeBeneficio(processo.beneficio) : `${ficha.situacao} sem processo`,
                `conversa de hoje por ${CANAIS_DO_REGISTRO[c.canal].rotulo.toLowerCase()} (${hora(c.abertaEm)})`,
                'o que a IA quer mudar',
              ].join(' · ')}
            </p>
          </div>

          {primeira && !souQuemConversou && (
            <p className={base.aviso} role="note">
              Quem confere é quem fez a conversa: {c.quem}, na hora. Não nasce tarefa para outra pessoa.
            </p>
          )}

          <section className={base.instrucoes} aria-labelledby="ia-quer-mudar">
            <div className={base.instrucoesTopo}>
              <span className={base.estrela} aria-hidden="true">
                ✦
              </span>
              <h2 id="ia-quer-mudar" className={base.instrucoesTitulo}>
                {mudancas.length ? 'A IA quer mudar a ficha e o processo pelo que foi dito na conversa' : 'A IA não tem nada a mudar'}
              </h2>
            </div>
            {!pronta ? (
              <p className={base.instrucoesTexto}>A transcrição ainda não ficou pronta: volte à conversa.</p>
            ) : mudancas.length === 0 ? (
              <p className={base.instrucoesTexto}>{g?.transcricao === 'sem-audio' ? 'Conversa sem áudio: só registro, nada muda na ficha.' : 'Nada do que foi dito muda a ficha ou o processo.'}</p>
            ) : (
              <ul className={proprio.conferencia} aria-label="O que a IA quer mudar">
                {mudancas.map((m) => {
                  const oculto = m.saude && !juridico
                  const situacao = situacaoDe(m)
                  const decidida = jaDecididas.has(m.id)
                  const pode = podeConfirmar(m.campo, papel)
                  const corrigindo = !decidida && decisoes[m.id]?.decisao === 'corrigida'
                  const valor = decisoes[m.id]?.valor ?? ''
                  return (
                    <li key={m.id} className={proprio.linhaConferencia}>
                      <span className={proprio.oQue}>
                        {m.onde === 'ficha' ? 'Ficha' : 'Processo'} ·{' '}
                        {oculto ? (
                          'fato novo de saúde · só o Jurídico vê'
                        ) : (
                          <>
                            {m.rotulo}: {m.antes ? `${valorLido(m.campo, m.antes)} → ` : ''}
                            {valorLido(m.campo, m.depois)} ({ditoAs(m.aos)})
                          </>
                        )}
                        {!oculto && (juridico || !falasDeSaude.has(m.aos)) && <span className={proprio.trecho}>«{m.trecho}»</span>}
                      </span>
                      {decidida ? (
                        <span className={proprio.situacao} data-situacao={situacao}>
                          {situacao}
                        </span>
                      ) : !pode ? (
                        <span className={proprio.quemPode}>quem pode: {QUEM_PODE}</span>
                      ) : (
                        <span className={proprio.botoesDaLinha} role="group" aria-label={`Conferir ${m.rotulo}`}>
                          {(['confirmada', 'corrigida', 'desfeita'] as const).map((d) => (
                            <button key={d} type="button" className={base.chip} aria-pressed={situacao === d} disabled={!podeAgir} onClick={() => decidir(m, d)}>
                              {d === 'confirmada' ? 'Confirmar' : d === 'corrigida' ? 'Corrigir' : 'Desfazer'}
                            </button>
                          ))}
                          {!situacao && <span className="so-leitor">{SEM_DECISAO}</span>}
                        </span>
                      )}
                      {corrigindo && (
                        <label className={proprio.correcao} htmlFor={`${idCorrecao}-${m.id}`}>
                          Corrigir {m.rotulo}
                          <input
                            id={`${idCorrecao}-${m.id}`}
                            className={vivo.texto}
                            value={valor}
                            inputMode={m.campo === 'telefone' || m.campo === 'pericia' ? 'numeric' : undefined}
                            onChange={(e) => setDecisoes((d) => ({ ...d, [m.id]: { id: m.id, decisao: 'corrigida', valor: e.target.value } }))}
                          />
                          {erroDoValor(m.campo, valor) && <span className={base.motivo}>{erroDoValor(m.campo, valor)}</span>}
                        </label>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <div className={base.atalhos}>
              <button type="button" className={base.atalho} onClick={() => setTranscricoes(true)}>
                Ver a transcrição
              </button>
              <button type="button" className={base.atalho} onClick={() => setHistorico(true)}>
                Ver o histórico
              </button>
            </div>
            <p className={base.nota}>A IA só muda o que foi dito na conversa; o valor antigo fica no histórico e a Sênior pode voltar a versão (G14).</p>
          </section>

          {primeira ? (
            <>
              <section className={base.cartao} aria-labelledby="surgiu-pendencia">
                <h2 id="surgiu-pendencia" className={base.cartaoTitulo}>
                  Surgiu pendência?
                </h2>
                <div className={base.opcoes} role="radiogroup" aria-labelledby="surgiu-pendencia">
                  <button type="button" role="radio" className={base.opcao} aria-checked={pendencia === 'nao'} disabled={!podeAgir} onClick={() => setPendencia('nao')}>
                    Não — confirmar e voltar ao D1
                  </button>
                  {/* A tarefa da pendência é da GGVP-88. */}
                  <button type="button" role="radio" className={base.opcao} aria-checked={false} aria-disabled="true">
                    Sim — criar a tarefa no card (D5.05)
                  </button>
                </div>
              </section>
              <p className={base.aviso}>
                A tarefa da pendência nasce com responsável: se você citar a pessoa, é ela; se citar só o setor, o sistema pergunta quem
                do setor; se não citar ninguém, pergunta quem é.
              </p>
            </>
          ) : (
            <section className={base.feito} aria-labelledby="conferida">
              <h2 id="conferida" className={base.feitoTitulo}>
                ✓ Conversa conferida por {c.quem}
              </h2>
              <p>
                O caso segue de onde parou{processo ? `: ${processo.etapa}${processo.proximaAcao ? ` · ${processo.proximaAcao}` : ''}` : ''}.
              </p>
              <div className={base.atalhos}>
                <a className={base.atalho} href={`/clientes/${ficha.id}`}>
                  Abrir o card do cliente
                </a>
                <a className={base.atalho} href={perfil?.inicio ?? '/'}>
                  Voltar ao início
                </a>
              </div>
            </section>
          )}

          {podeAgir && (
            <div className={base.rodape} role="group" aria-label="Concluir a conferência">
              <button type="button" className={base.principalBotao} disabled={motivoParado !== null || enviando} onClick={confirmar}>
                {enviando ? 'conferindo…' : 'Confirmar'}
              </button>
              <button
                type="button"
                className={vivo.secundario}
                disabled={abertas.length === 0}
                onClick={() => setDecisoes(Object.fromEntries(abertas.map((m) => [m.id, { id: m.id, decisao: 'desfeita' as const }])))}
              >
                Desfazer
              </button>
              {motivoParado && <p className={base.motivo}>{motivoParado}</p>}
              {erro && (
                <p role="alert" className={base.motivo}>
                  {erro}
                </p>
              )}
            </div>
          )}
        </div>

        <aside className={base.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={base.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={base.ladoSub}>O que o BPMN (Miro) pede no passo D5.04.</p>
          <h3 className={base.ladoSecao}>Campos</h3>
          <ul className={base.ladoLista}>
            <li>• Cada mudança da IA confirmada, corrigida ou desfeita*</li>
            <li>• «Surgiu pendência?» respondida*</li>
          </ul>
          <h3 className={base.ladoSecao}>Travas</h3>
          <p className={base.ladoSub}>
            «Confirmar» só habilita com todas as mudanças conferidas. Quem confere é quem fez a conversa, na hora; o que o perfil não pode
            mudar fica para quem pode. O valor antigo fica no histórico do card e a Sênior pode voltar a versão (G14).
          </p>
        </aside>
      </main>
      <AbaSuporte />
      {transcricoes && <Transcricoes ficha={ficha} perfil={juridico ? 'juridico' : 'atendimento'} inicial={g?.id} aoFechar={() => setTranscricoes(false)} />}
      {historico && <HistoricoDeVersoes ficha={ficha} funcao={perfil?.rotulo} aoFechar={() => setHistorico(false)} />}
    </>
  )
}
