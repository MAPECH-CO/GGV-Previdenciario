import { useEffect, useId, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { HistoricoDeVersoes } from '../componentes/HistoricoDeVersoes.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { Transcricoes } from '../componentes/Transcricoes.tsx'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { dataParaIso, normalizarData } from '../campos.ts'
import { conferirConversa, cumprirPendencia, novoPrazoDaPendencia, obterConversa, responsaveisDaPendencia, type ConversaAberta } from '../dados/conversa.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import {
  CANAIS_DO_REGISTRO,
  QUEM_PODE,
  TAMANHO_DO_COMBINADO,
  erroDoValor,
  motivoParaNaoConferir,
  motivoParaNaoCriarPendencia,
  papelDoPerfil,
  podeConfirmar,
  responsavelDaPendencia,
  situacaoDaPendencia,
  valorLido,
  type DecisaoDaMudanca,
  type Mudanca,
  type Pessoa,
} from '../regras/conversa.ts'
import { dataCurta, dataHora, hojeIso, hora } from '../regras/datas.ts'
import { COMO_VERIFICOU, ehProtegido, motivoParaNaoMudar, verificacaoDaConversa, type ComoVerificou } from '../regras/seguranca.ts'
import { relogio } from '../regras/entrevista.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
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
  const [pendencia, setPendencia] = useState<'nao' | 'sim' | null>(null)
  // O combinado: sem edição, o que a IA ouviu na conversa (GGVP-88).
  const [combinado, setCombinado] = useState<string | null>(null)
  const [prazo, setPrazo] = useState('')
  const [escolhido, setEscolhido] = useState<string | undefined>()
  const [trocando, setTrocando] = useState(false)
  const [novoPrazo, setNovoPrazo] = useState('')
  // Como quem conversou confirmou que é o cliente, para mudar telefone ou e-mail (GGVP-111).
  const [verificacao, setVerificacao] = useState<{ como?: ComoVerificou; contratoNovo?: true }>({})
  const [transcricoes, setTranscricoes] = useState(false)
  const [historico, setHistorico] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  // Quem pode ficar com a pendência: as pessoas do escritório, do servidor (GGVP-88, CA3).
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const travado = useRef(false)
  const perfil = usePerfil(dados?.conversa.papel === 'juridico' ? 'Advogada' : 'Atendimento')

  useEffect(() => {
    let valendo = true
    obterConversa(conversaId).then((d) => {
      if (valendo) setDados(d)
    })
    responsaveisDaPendencia()
      .then((lista) => valendo && setPessoas(lista))
      .catch(() => undefined)
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
  const pronta = !g || g.transcricao === 'pronta' || g.transcricao === 'sem-audio'
  const hoje = hojeIso(agora())
  const texto = combinado ?? c.analise?.pendencia ?? ''
  // A regra do chat (CA3): citou a pessoa, é ela; citou o setor, pergunta quem do setor; ninguém, pergunta quem é.
  const auto = responsavelDaPendencia(texto, pessoas)
  const responsavel = escolhido ?? (auto.tipo === 'pessoa' && !trocando ? auto.pessoa.nome : undefined)
  const opcoes = trocando ? pessoas : auto.tipo === 'pessoa' ? [] : auto.opcoes
  // Telefone e e-mail só mudam com o cliente verificado (GGVP-111, CA1, CA8); presencial com o próprio cliente já vale.
  const automatica = verificacaoDaConversa(c)
  const pedeVerificacao = !automatica && abertas.some((m) => ehProtegido(m.campo))
  const contatoMudando = lista.filter((d) => d.decisao !== 'desfeita').map((d) => mudancas.find((m) => m.id === d.id)!.campo).find(ehProtegido)
  const motivoDoContato = contatoMudando && !automatica ? motivoParaNaoMudar(contatoMudando, verificacao) : null
  const motivoParado = !pronta
    ? 'A transcrição ainda não ficou pronta.'
    : (motivoParaNaoConferir(mudancas, lista, papel, [...jaDecididas.keys()]) ??
      motivoDoContato ??
      (primeira && pendencia === null
        ? 'Responda "Surgiu pendência?".'
        : primeira && pendencia === 'sim'
          ? motivoParaNaoCriarPendencia({ texto, responsavel, prazo }, pessoas, hoje)
          : !primeira && lista.length === 0
            ? 'Confira o que ficou para o Jurídico.'
            : null))
  const p = c.pendencia
  const situacaoDaTarefa = p && situacaoDaPendencia(p.prazo, hoje, Boolean(p.cumpridaEm))
  const senior = perfil?.id === 'senior'
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
      const nova = pendencia === 'sim' ? { surgiu: true as const, texto, responsavel: responsavel!, prazo } : { surgiu: false as const }
      setDados(await conferirConversa(c.id, { decisoes: lista, verificacao, ...(primeira && { pendencia: nova }) }))
      setDecisoes({})
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para conferir.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  /** Dar por cumprida ou o prazo novo da Sênior (GGVP-88, CA5). */
  async function naPendencia(acao: () => Promise<ConversaAberta>) {
    if (travado.current || !perfil) return
    travado.current = true
    setEnviando(true)
    setErro('')
    try {
      setDados(await acao())
      setNovoPrazo('')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para registrar.')
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
                  const situacao = situacaoDe(m)
                  const decidida = jaDecididas.has(m.id)
                  const pode = podeConfirmar(m.campo, papel)
                  const corrigindo = !decidida && decisoes[m.id]?.decisao === 'corrigida'
                  const valor = decisoes[m.id]?.valor ?? ''
                  return (
                    <li key={m.id} className={proprio.linhaConferencia}>
                      <span className={proprio.oQue}>
                        {m.onde === 'ficha' ? 'Ficha' : 'Processo'} ·{' '}
                        {m.rotulo}: {m.antes ? `${valorLido(m.campo, m.antes)} → ` : ''}
                        {valorLido(m.campo, m.depois)} ({ditoAs(m.aos)})
                        <span className={proprio.trecho}>«{m.trecho}»</span>
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

          {pedeVerificacao && podeAgir && (
            <section className={base.cartao} aria-labelledby="verificacao-do-cliente">
              <h2 id="verificacao-do-cliente" className={base.cartaoTitulo}>
                Telefone e e-mail: como você confirmou que é o cliente?
              </h2>
              <p className={base.motivo}>
                {c.comQuem === 'cliente' ? 'Foi uma ligação' : 'Quem falou não foi o cliente'}: telefone e e-mail só mudam com o cliente verificado, por chamada de
                vídeo ou no escritório, e a alteração vai em contrato novo. Sem isso, desfaça a mudança.
              </p>
              <div className={base.ladoOpcoes} role="radiogroup" aria-labelledby="verificacao-do-cliente">
                {(Object.keys(COMO_VERIFICOU) as ComoVerificou[]).map((como) => (
                  <button key={como} type="button" role="radio" className={base.chip} aria-checked={verificacao.como === como} onClick={() => setVerificacao((v) => ({ ...v, como }))}>
                    {COMO_VERIFICOU[como]}
                  </button>
                ))}
              </div>
              <label className={vivo.conferencia}>
                <input
                  type="checkbox"
                  checked={verificacao.contratoNovo === true}
                  onChange={(e) => setVerificacao((v) => ({ ...v, contratoNovo: e.target.checked ? true : undefined }))}
                />
                A alteração vai em contrato novo
              </label>
            </section>
          )}

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
                  <button type="button" role="radio" className={base.opcao} aria-checked={pendencia === 'sim'} disabled={!podeAgir} onClick={() => setPendencia('sim')}>
                    Sim — criar a tarefa no card (D5.05)
                  </button>
                </div>
                {pendencia === 'sim' && (
                  <div className={proprio.pendencia}>
                    <label className={proprio.campo} htmlFor={`${idCorrecao}-combinado`}>
                      O que ficou combinado *
                      <textarea
                        id={`${idCorrecao}-combinado`}
                        className={vivo.texto}
                        rows={3}
                        maxLength={TAMANHO_DO_COMBINADO.maximo}
                        value={texto}
                        onChange={(e) => {
                          setCombinado(e.target.value)
                          setEscolhido(undefined)
                          setTrocando(false)
                        }}
                      />
                    </label>
                    <label className={proprio.campo} htmlFor={`${idCorrecao}-prazo`}>
                      Prazo *
                      <input
                        id={`${idCorrecao}-prazo`}
                        className={vivo.texto}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="dd/mm/aaaa"
                        value={prazo}
                        onChange={(e) => setPrazo(soNumeroEMascara(e.target.value))}
                      />
                    </label>
                    {/* Figma 2052:186 e 2176:2: "Escolha o responsável" e "Ação para confirmar". */}
                    <div className={proprio.responsavel} role="group" aria-label={responsavel ? 'Ação para confirmar' : 'Escolha o responsável'}>
                      <span className={proprio.selo}>{responsavel ? 'Ação para confirmar' : 'Escolha o responsável'}</span>
                      <p className={proprio.previa}>
                        <span className={proprio.nova}>nova</span>
                        <span>
                          <strong>{ficha.nome}</strong> · Cumprir pendência
                          <span className={proprio.previaDetalhe}>
                            {[texto || 'o combinado', `vence ${dataParaIso(normalizarData(prazo)) ? dataCurta(dataParaIso(normalizarData(prazo))!, hoje) : '—'}`].join(' · ')}
                            {' · '}responsável: {responsavel ?? 'a escolher'}
                          </span>
                        </span>
                      </p>
                      {responsavel && !opcoes.length ? (
                        <p>
                          Responsável: <strong>{responsavel}</strong> · {pessoas.find((x) => x.nome === responsavel)?.setor}{' '}
                          <button type="button" className={proprio.trocar} onClick={() => (setEscolhido(undefined), setTrocando(true))}>
                            Trocar
                          </button>
                        </p>
                      ) : (
                        <>
                          <p>
                            {auto.tipo === 'setor' && !trocando
                              ? `${auto.setor.split(' ·')[0]} tem ${auto.opcoes.length} ${auto.opcoes.length === 1 ? 'pessoa' : 'pessoas'}. Quem fica com esta tarefa?`
                              : 'Quem fica com esta tarefa?'}
                          </p>
                          <div className={base.ladoOpcoes} role="radiogroup" aria-label="Responsável">
                            {opcoes.map((x) => (
                              <button key={x.nome} type="button" role="radio" className={base.chip} aria-checked={escolhido === x.nome} onClick={() => setEscolhido(x.nome)}>
                                {x.nome}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <p className={base.nota}>Se você escrever o nome (ex.: “a Jéssica recebe…”), ela já fica como responsável. Sem nome nem setor, eu pergunto quem é.</p>
                    </div>
                  </div>
                )}
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
              {p ? (
                <div className={proprio.pendencia} role="group" aria-label="Pendência da conversa">
                  <p>
                    <strong>Tarefa no card:</strong> {p.responsavel} ({p.setor}) · Cumprir pendência · {p.texto}
                  </p>
                  <p role="status">
                    {situacaoDaTarefa === 'cumprida' && `✓ Cumprida por ${p.cumpridaPor} em ${dataHora(p.cumpridaEm!)}.`}
                    {situacaoDaTarefa === 'no-prazo' && `Vence ${dataCurta(p.prazo, hoje)}.`}
                    {situacaoDaTarefa === 'lembrete' && `O prazo venceu em ${dataCurta(p.prazo, hoje)}: lembrete ao responsável.`}
                    {situacaoDaTarefa === 'na-senior' && `O prazo venceu em ${dataCurta(p.prazo, hoje)}: subiu para a Sênior decidir.`}
                  </p>
                  {situacaoDaTarefa !== 'cumprida' && (perfil?.usuario === p.responsavel || senior) && (
                    <div className={base.atalhos}>
                      <button type="button" className={base.atalho} disabled={enviando} onClick={() => naPendencia(() => cumprirPendencia(c.id))}>
                        Marcar como cumprida
                      </button>
                    </div>
                  )}
                  {senior && (situacaoDaTarefa === 'lembrete' || situacaoDaTarefa === 'na-senior') && (
                    <div className={base.atalhos}>
                      <label className={proprio.campo} htmlFor={`${idCorrecao}-novo-prazo`}>
                        Prazo novo
                        <input
                          id={`${idCorrecao}-novo-prazo`}
                          className={vivo.texto}
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="dd/mm/aaaa"
                          value={novoPrazo}
                          onChange={(e) => setNovoPrazo(soNumeroEMascara(e.target.value))}
                        />
                      </label>
                      <button type="button" className={base.atalho} disabled={enviando || novoPrazo.length < 10} onClick={() => naPendencia(() => novoPrazoDaPendencia(c.id, novoPrazo))}>
                        Dar prazo novo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p>Não surgiu pendência: nenhuma tarefa nasceu.</p>
              )}
              {erro && !podeAgir && (
                <p role="alert" className={base.motivo}>
                  {erro}
                </p>
              )}
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
            <li>• Se «Sim»: o que ficou combinado*, prazo* e responsável* (nunca presumido)</li>
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
