import { useEffect, useId, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoCofre } from '../componentes/CampoCofre.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { Transcricoes } from '../componentes/Transcricoes.tsx'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { anexarAudio, falasDaConversa, finalizarConversa, gravarConversa, obterConversa, transcreverConversa, type ConversaAberta } from '../dados/conversa.ts'
import { registrarAcao } from '../dados/entrevista.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import type { Gravacao, SenhaGov } from '../dados/tipos.ts'
import { CANAIS_DO_REGISTRO, COM_QUEM, MODOS_DO_REGISTRO, ONDE, papelDoPerfil, valorLido, type CanalDoRegistro, type Mudanca } from '../regras/conversa.ts'
import { hojeIso, hora } from '../regras/datas.ts'
import { minutos, relogio, tirarSenhas } from '../regras/entrevista.ts'
import { situacaoDaSenha } from '../regras/fichaAtendimento.ts'
import base from './Balcao.module.css'
import proprio from './Conversa.module.css'
import vivo from './EntrevistaAoVivo.module.css'

// Figma step_D5.01 (2281:2), com a transcrição ao vivo de "Atendimento · Reunião com transcrição" (73:560). A gravação é a
// da entrevista (GGVP-40), simulada: o relógio corre e a IA "ouve" a conversa de exemplo. `simular=falha-da-transcricao`
// abre a falha; `passo` é quantos milissegundos dura um segundo de gravação (o teste acelera).

type Props = { conversaId: string; simular?: string; passo?: number }

export function Conversa({ conversaId, simular, passo = 1000 }: Props) {
  const idAvisei = useId()
  const idArquivo = useId()
  const idAvisoNaLigacao = useId()
  const [dados, setDados] = useState<ConversaAberta | null | undefined>(undefined)
  const [segundos, setSegundos] = useState(0)
  const [lembrete, setLembrete] = useState(false)
  const [avisei, setAvisei] = useState(false)
  const [cofre, setCofre] = useState(false)
  const [recarregou, setRecarregou] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [avisoNaLigacao, setAvisoNaLigacao] = useState(false)
  const [transcricoes, setTranscricoes] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const pedindo = useRef(false)
  const falhou = useRef(false)
  const perfil = usePerfil(dados?.conversa.papel === 'juridico' ? 'Advogada' : 'Atendimento')

  useEffect(() => {
    let valendo = true
    obterConversa(conversaId).then(async (d) => {
      if (!valendo) return
      // A página recarregou no meio: a gravação volta pausada no último ponto guardado.
      if (d?.gravacao?.estado === 'gravando') {
        d = { ...d, gravacao: await registrarAcao(d.gravacao.id, 'pausou', d.gravacao.duracao) }
        if (!valendo) return
        setRecarregou(true)
      }
      setDados(d)
      setSegundos(d?.gravacao?.duracao ?? 0)
    })
    return () => {
      valendo = false
    }
  }, [conversaId])

  const g = dados?.gravacao
  const gravando = g?.estado === 'gravando'
  useEffect(() => {
    if (!gravando) return
    const relogioDaGravacao = setInterval(() => setSegundos((s) => s + 1), passo)
    return () => clearInterval(relogioDaGravacao)
  }, [gravando, passo])

  async function fazer(acao: () => Promise<Gravacao | ConversaAberta>) {
    if (travado.current) return
    travado.current = true
    setOcupado(true)
    setErro('')
    try {
      const r = await acao()
      setDados((d) => ('conversa' in r ? r : d && { ...d, gravacao: r }))
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  // Finalizada ou anexada: o áudio vai para a transcrição (CA6), com o mesmo motor da entrevista.
  useEffect(() => {
    if (g?.estado !== 'encerrada' || g.transcricao !== 'transcrevendo' || pedindo.current) return
    pedindo.current = true
    const falhar = simular === 'falha-da-transcricao' && !falhou.current
    falhou.current ||= falhar
    transcreverConversa(conversaId, { falhar })
      .then(setDados)
      .finally(() => {
        pedindo.current = false
      })
  }, [g, conversaId, simular])

  if (!dados) {
    return (
      <main className={vivo.vazia}>
        <title>Conversa · GGV Previdenciário</title>
        <h1 className={base.titulo}>{dados === null ? 'Conversa não encontrada' : 'Abrindo a conversa…'}</h1>
        {dados === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { conversa: c, ficha } = dados
  const processo = ficha.processos.find((p) => p.id === c.processoId)
  const encerrada = g?.estado === 'encerrada'
  const papel = c.papel === 'juridico' ? 'Jurídico' : 'Atendimento'
  // Dado de saúde só para o Jurídico, pelo perfil de quem está na tela.
  const juridico = papelDoPerfil(perfil?.id) === 'juridico'
  const analise = g?.transcricao === 'pronta' ? c.analise : undefined
  const falasDeSaude = new Set(analise?.mudancas.filter((m) => m.saude).map((m) => m.aos))
  const ditoAs = (aos: number) =>
    g?.avisoEm ? `dito às ${hora(new Date(Date.parse(g.avisoEm) + aos * 1000).toISOString())}` : `aos ${relogio(aos).slice(3)} do áudio`
  const aviso = g?.avisoEm ? ` · aviso de gravação feito às ${hora(g.avisoEm)} (G10)` : ''
  // A transcrição ao vivo já sai sem a senha dita em voz alta (G9).
  const aoVivo = g && c.modo === 'tempo-real' ? tirarSenhas(falasDaConversa(ficha, c).filter((f) => f.aos <= segundos)) : []
  const trechos = encerrada && g.transcricao === 'pronta' ? g.trechos : aoVivo

  const situacao = !g
    ? 'Antes de gravar · avise o cliente (G10)'
    : g.estado === 'gravando'
      ? `● Gravando · ${relogio(segundos)}${aviso}`
      : g.estado === 'pausada'
        ? cofre
          ? `❚❚ Pausada para a senha do gov.br · ${relogio(segundos)} · nada entra no áudio (G9)`
          : `❚❚ Pausada · ${relogio(segundos)}${aviso}`
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
      <title>{`${ficha.nome} · Registrar conversa · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Você · ${perfil?.rotulo ?? papel}`} inicio={perfil?.inicio} />
      <main className={base.pagina}>
        <div className={base.principal}>
          <div className={base.cabecalho}>
            <div className={base.chips}>
              <span className={base.codigo} title="D5.01 · Registrar a conversa (passo do BPMN)">
                D5.01
              </span>
              <span className={proprio.setor}>{papel}</span>
            </div>
            <h1 className={base.titulo}>
              <strong>{ficha.nome}</strong> · Registrar conversa
            </h1>
            <p className={base.subtitulo}>
              {[
                processo ? nomeBeneficio(processo.beneficio) : `${ficha.situacao}${ficha.processos.length === 0 ? ' sem processo' : ''}`,
                c.motivo ?? (c.canal === 'ligacao' ? 'ligou para o escritório' : 'veio ao escritório'),
                `${CANAIS_DO_REGISTRO[c.canal].rotulo.toLowerCase()}, com ${COM_QUEM[c.comQuem].toLowerCase()}`,
              ].join(' · ')}
            </p>
          </div>

          <section className={base.instrucoes} aria-labelledby="aviso-g10">
            <div className={base.instrucoesTopo}>
              <span className={base.estrela} aria-hidden="true">
                ✦
              </span>
              <h2 id="aviso-g10" className={base.instrucoesTitulo}>
                Aviso de gravação (G10) · senha no cofre (G9)
              </h2>
            </div>
            <p className={base.instrucoesTexto}>
              Comece avisando que a conversa será gravada; pessoalmente ou por telefone, o aviso fica registrado na gravação. Se o
              cliente disser a senha do gov.br, use o cofre, nunca a transcrição.
            </p>
            <div className={base.atalhos}>
              <a className={base.atalho} href={`/clientes/${ficha.id}`}>
                Abrir o card do cliente
              </a>
              <button type="button" className={base.atalho} onClick={() => setTranscricoes(true)}>
                Ver as transcrições
              </button>
            </div>
            <p className={base.nota}>
              Depois de finalizar, a IA transcreve e marca o que muda na ficha e no processo (D5.02); nada vai para a ficha sem você
              conferir (D5.04).
            </p>
          </section>

          <section className={base.cartao} aria-labelledby="canal-da-conversa">
            <h2 id="canal-da-conversa" className={base.cartaoTitulo}>
              Canal da conversa
            </h2>
            <div className={base.opcoes} role="radiogroup" aria-labelledby="canal-da-conversa">
              {(Object.keys(CANAIS_DO_REGISTRO) as CanalDoRegistro[]).map((canal) => (
                <button key={canal} type="button" role="radio" className={base.opcao} aria-checked={c.canal === canal} disabled={c.canal !== canal}>
                  {CANAIS_DO_REGISTRO[canal].passo}
                </button>
              ))}
            </div>
            <p className={base.motivo}>
              Com quem: {COM_QUEM[c.comQuem]} · Gravação: {MODOS_DO_REGISTRO[c.modo].rotulo}
            </p>
          </section>

          <p className={base.aviso}>
            Quando usar: lead que ainda não foi aceito ou cliente com o caso em análise; dúvida sobre o processo ou informação nova que
            muda a ficha (D5 no Miro).
          </p>

          {recarregou && g?.estado === 'pausada' && <p className={vivo.alerta}>A página recarregou: a gravação ficou pausada em {relogio(segundos)}. Retome quando quiser.</p>}
          {erro && (
            <p className={vivo.alerta} role="alert">
              {erro}
            </p>
          )}

          {c.modo === 'tempo-real' && (
            <section className={base.cartao} aria-labelledby="tempo-real">
              <div className={proprio.linhaDoTitulo}>
                <h2 id="tempo-real" className={base.cartaoTitulo}>
                  {encerrada ? 'Transcrição' : 'Transcrição em tempo real'}
                </h2>
                <span className={vivo.estado} data-estado={g?.estado ?? 'antes'} role="status">
                  {situacao}
                </span>
              </div>
              <div className={vivo.botoes}>
                {!g && (
                  <button type="button" className={vivo.primario} onClick={() => setLembrete(true)}>
                    Gravar
                  </button>
                )}
                {g?.estado === 'gravando' && (
                  <button type="button" className={vivo.secundario} disabled={ocupado} onClick={() => fazer(() => registrarAcao(g.id, 'pausou', segundos))}>
                    Pausar
                  </button>
                )}
                {g?.estado === 'pausada' && !cofre && (
                  <button
                    type="button"
                    className={vivo.secundario}
                    disabled={ocupado}
                    onClick={() => {
                      setRecarregou(false)
                      fazer(() => registrarAcao(g.id, 'retomou', segundos))
                    }}
                  >
                    Retomar
                  </button>
                )}
                {g?.estado === 'gravando' && (
                  <button
                    type="button"
                    className={vivo.secundario}
                    disabled={ocupado}
                    onClick={() => {
                      setCofre(true)
                      fazer(() => registrarAcao(g.id, 'abriu-cofre', segundos))
                    }}
                  >
                    🔒 Abrir o cofre (pausa a gravação)
                  </button>
                )}
                {(g?.estado === 'gravando' || (g?.estado === 'pausada' && !cofre)) && (
                  <button type="button" className={vivo.primario} disabled={ocupado} onClick={() => fazer(() => finalizarConversa(c.id, { aos: segundos }))}>
                    Finalizar conversa
                  </button>
                )}
              </div>

              {lembrete && !g && (
                <div className={vivo.lembrete} role="group" aria-labelledby="lembrete-do-aviso">
                  <h3 id="lembrete-do-aviso" className={vivo.cartaoTitulo}>
                    Antes de gravar, avise que a conversa será gravada (G10)
                  </h3>
                  <p>Diga, com estas palavras ou parecidas:</p>
                  <blockquote className={vivo.frase}>“{ficha.nome.split(' ')[0]}, esta conversa vai ser gravada e transcrita para atualizar a sua ficha. Tudo bem?”</blockquote>
                  <label className={vivo.conferencia} htmlFor={idAvisei}>
                    <input id={idAvisei} type="checkbox" checked={avisei} onChange={(e) => setAvisei(e.target.checked)} />
                    Avisei que a conversa será gravada
                  </label>
                  <div className={vivo.acoes}>
                    <button type="button" className={vivo.primario} disabled={!avisei || ocupado} onClick={() => fazer(() => gravarConversa(c.id, { avisei: true }))}>
                      {ocupado ? 'começando…' : 'Começar a gravar'}
                    </button>
                    <button type="button" className={vivo.secundario} onClick={() => setLembrete(false)}>
                      Cancelar
                    </button>
                  </div>
                  <p className={base.nota}>A gravação só começa depois do aviso; o portal guarda a hora do aviso.</p>
                </div>
              )}

              {cofre && g && (
                <div className={vivo.lembrete} role="group" aria-labelledby="cofre-da-conversa">
                  <h3 id="cofre-da-conversa" className={vivo.cartaoTitulo}>
                    Senha do gov.br
                  </h3>
                  <p className={vivo.vazio}>gov.br: {situacaoDaSenha(ficha.senhaGov, hojeIso(agora()))}</p>
                  <CampoCofre fichaId={ficha.id} senhaGov={ficha.senhaGov} aoMudar={aoMudarSenha} />
                  <button
                    type="button"
                    className={vivo.secundario}
                    onClick={() => {
                      setCofre(false)
                      fazer(() => registrarAcao(g.id, 'retomou', segundos))
                    }}
                  >
                    Fechar o cofre e retomar
                  </button>
                  <p className={base.nota}>O cliente digita a senha no cofre; o trecho não entra no áudio nem na transcrição (G9).</p>
                </div>
              )}

              {encerrada && g.soJuridico && !juridico ? (
                <p className={vivo.vazio}>A transcrição completa fica só para o Jurídico: a conversa tem dado de saúde.</p>
              ) : trechos.length === 0 ? (
                <p className={vivo.vazio}>A transcrição aparece aqui quando a gravação começar.</p>
              ) : (
                <ol className={vivo.falas} aria-label="Falas">
                  {trechos.map((t) => (
                    <li key={t.aos} className={vivo.fala}>
                      <span className={vivo.quando}>{relogio(t.aos).slice(3)}</span>
                      <span className={vivo.quem} data-papel={t.papel}>
                        {t.quem}
                      </span>
                      <span>{t.texto}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className={vivo.ia}>
                <span aria-hidden="true">✦ </span>A IA está ouvindo com o mesmo motor da entrevista. Senha do gov.br não entra na
                transcrição: vai ao cofre (G9).
              </p>
            </section>
          )}

          {c.modo === 'arquivo' && !g && (
            <section className={base.cartao} aria-labelledby="gravacao-da-ligacao">
              <h2 id="gravacao-da-ligacao" className={base.cartaoTitulo}>
                Gravação da ligação
              </h2>
              <label className={proprio.campo} htmlFor={idArquivo}>
                Áudio da ligação (qualquer formato, sem limite de tamanho)
                <input id={idArquivo} type="file" accept="audio/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </label>
              <label className={vivo.conferencia} htmlFor={idAvisoNaLigacao}>
                <input id={idAvisoNaLigacao} type="checkbox" checked={avisoNaLigacao} onChange={(e) => setAvisoNaLigacao(e.target.checked)} />
                A ligação começou com o aviso de que seria gravada (G10)
              </label>
              <button
                type="button"
                className={vivo.primario}
                disabled={!arquivo || !avisoNaLigacao || ocupado}
                onClick={() => fazer(() => anexarAudio(c.id, { nome: arquivo!.name, tipo: arquivo!.type, tamanho: arquivo!.size, avisoNaGravacao: true }))}
              >
                {ocupado ? 'anexando…' : 'Anexar e transcrever'}
              </button>
              <p className={base.nota}>O áudio fica no card do cliente, guardado; a IA transcreve e marca o que muda (D5.02).</p>
            </section>
          )}

          {c.modo === 'escrito' && (
            <section className={base.cartao} aria-labelledby="registro-escrito">
              <h2 id="registro-escrito" className={base.cartaoTitulo}>
                Registro escrito · só registro
              </h2>
              <p className={proprio.texto}>{c.registro}</p>
              <p className={base.nota}>Sem áudio, não há transcrição: o registro aparece como "só registro" nas transcrições do card.</p>
            </section>
          )}

          {encerrada && (
            <section className={base.feito} aria-labelledby="finalizada">
              <h2 id="finalizada" className={base.feitoTitulo}>
                {g.transcricao === 'sem-audio' ? '✓ Conversa registrada sem áudio' : g.origem === 'arquivo' ? '✓ Gravação da ligação anexada' : `✓ Conversa finalizada · ${minutos(g.duracao)}`}
              </h2>
              {g.audio && <p>O áudio ficou guardado no card do cliente: {g.audio.nome}.</p>}
              <p role="status">
                {g.transcricao === 'transcrevendo' && 'Transcrevendo (D5.02)…'}
                {g.transcricao === 'pronta' && 'Transcrição pronta (D5.02): o texto está nas transcrições do card.'}
                {g.transcricao === 'falhou' && `A transcrição falhou: ${g.motivoDaFalha}. O áudio está guardado; nada se perdeu.`}
                {g.transcricao === 'sem-audio' && 'O registro ficou no card, como "só registro".'}
              </p>
              <div className={base.atalhos}>
                {g.transcricao === 'falhou' && (
                  <button type="button" className={base.atalho} disabled={ocupado} onClick={() => fazer(() => transcreverConversa(c.id))}>
                    Tentar de novo
                  </button>
                )}
                <button type="button" className={base.atalho} onClick={() => setTranscricoes(true)}>
                  Ver a transcrição
                </button>
              </div>
            </section>
          )}

          {analise && (
            <section className={proprio.ia} aria-labelledby="o-que-a-ia-achou">
              <h2 id="o-que-a-ia-achou" className={proprio.iaTitulo}>
                <span aria-hidden="true">✦ </span>O que a IA encontrou na conversa
              </h2>
              {(
                [
                  ['O que mudou', analise.mudancas.filter((m) => m.antes)],
                  ['Dados novos', analise.mudancas.filter((m) => !m.antes)],
                ] as [string, Mudanca[]][]
              ).map(([titulo, lista]) => (
                <div key={titulo} className={proprio.iaParte}>
                  <h3 className={proprio.iaSub}>{titulo}</h3>
                  {lista.length === 0 ? (
                    <p className={base.nota}>Nada.</p>
                  ) : (
                    <ul className={proprio.mudancas} aria-label={titulo}>
                      {lista.map((m) =>
                        m.saude && !juridico ? (
                          <li key={m.id}>• {m.onde === 'ficha' ? 'Ficha' : 'Processo'} · fato novo de saúde · só o Jurídico vê</li>
                        ) : (
                          <li key={m.id}>
                            • {m.onde === 'ficha' ? 'Ficha' : 'Processo'} · {m.rotulo}: {m.antes ? `${valorLido(m.campo, m.antes)} → ` : ''}
                            {valorLido(m.campo, m.depois)} ({ditoAs(m.aos)})
                            {/* O trecho da mesma fala do fato de saúde também é dado de saúde: só o Jurídico vê. */}
                            {(juridico || !falasDeSaude.has(m.aos)) && <span className={proprio.trecho}>«{m.trecho}»</span>}
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              ))}
              <div className={proprio.iaParte}>
                <h3 className={proprio.iaSub}>O que precisa atualizar</h3>
                <p className={proprio.chips}>
                  {(['ficha', 'processo'] as const).map((onde) => (
                    <span key={onde} className={proprio.chip} data-marcado={analise.atualizar.includes(onde)}>
                      {analise.atualizar.includes(onde) ? '✓ ' : ''}
                      {ONDE[onde]}
                    </span>
                  ))}
                </p>
              </div>
              <div className={proprio.iaParte}>
                <h3 className={proprio.iaSub}>Observação</h3>
                <p>{analise.observacao}</p>
              </div>
              {analise.pendencia && (
                <div className={proprio.iaParte}>
                  <h3 className={proprio.iaSub}>Combinado na conversa</h3>
                  <p>{analise.pendencia}</p>
                </div>
              )}
              <div className={base.atalhos}>
                <a className={vivo.primario} href={`/conversas/${c.id}/conferir`}>
                  Conferir e atualizar (D5.04)
                </a>
              </div>
              <p className={base.nota}>A IA só muda o que foi dito; nada vai para a ficha nem para o processo sem você conferir (G14).</p>
            </section>
          )}
        </div>

        <aside className={base.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={base.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={base.ladoSub}>O que o BPMN (Miro) pede no passo D5.01.</p>
          <h3 className={base.ladoSecao}>Campos</h3>
          <ul className={base.ladoLista}>
            <li>• Canal da conversa (telefone ou presencial)*</li>
            <li>• Com quem falou*</li>
            <li>• Aviso de gravação registrado (G10)*</li>
            <li>• Gravação ou áudio da ligação* (sem áudio, só o registro escrito)</li>
          </ul>
          <h3 className={base.ladoSecao}>Travas</h3>
          <p className={base.ladoSub}>
            «Gravar» só começa depois do aviso registrado (G10); «Anexar» pede a confirmação do aviso na ligação. A senha dita vai para
            o cofre, nunca para a transcrição (G9).
          </p>
        </aside>
      </main>
      <AbaSuporte />
      {transcricoes && (
        <Transcricoes ficha={ficha} perfil={c.papel === 'juridico' ? 'juridico' : 'atendimento'} inicial={g?.id} aoFechar={() => setTranscricoes(false)} />
      )}
    </>
  )
}
