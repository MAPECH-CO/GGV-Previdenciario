import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { ConferirEnviar } from '../componentes/ConferirEnviar.tsx'
import { ConviteChatwoot } from '../componentes/ConviteChatwoot.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { dataParaIso, formatarTelefone, normalizarData } from '../campos.ts'
import { decidirComplemento, obterComplemento, registrarTentativaDoComplemento, type ComplementoNaTela } from '../dados/complemento.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { CANAIS, DIAS_ENTRE_COBRANCAS, RESULTADOS, TENTATIVAS_DE_COBRANCA, motivoParaNaoDecidir } from '../regras/cobranca.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './Cobranca.module.css'
import parecer from './Parecer.module.css'

// Sem quadro próprio no Figma: no visual de "Cobrar documento · pendentes do checklist" (2106:3), com o botão "Pedir
// complemento ao médico" do Parecer médico (1654:2). Tela do Atendimento (GGVP-29); a sênior decide no limite (G15).

export function PedirComplemento({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Atendimento')
  const senior = perfil?.id.startsWith('senior') === true
  const [c, setC] = useState<ComplementoNaTela | null | undefined>(undefined)
  const [aberto, setAberto] = useState<'ligar' | 'chatwoot' | 'anexar' | null>(null)
  const [resultado, setResultado] = useState<'respondeu' | 'sem-resposta'>()
  const [prazo, setPrazo] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterComplemento(processoId).then((x) => valendo && setC(x))
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!c) {
    return (
      <main className={proprio.vazia}>
        <title>Pedir complemento ao médico · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{c === null ? 'Este caso não tem pedido de complemento' : 'Abrindo o pedido…'}</h1>
        {c === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, beneficio, complemento, situacao, previa } = c
  const hoje = hojeIso(agora())
  const primeiro = ficha.nome.split(' ')[0]
  const parado = situacao !== 'aberto' || c.motivoParado !== null
  const ultima = c.tentativa === TENTATIVAS_DE_COBRANCA
  const nomeDoParecer = complemento.parecer === 'contraditorio' ? 'Contraditório' : 'Insuficiente'
  const isoPrazo = dataParaIso(prazo)
  const motivoDecidir = motivoParaNaoDecidir({ opcao: 'nova-tentativa', justificativa, prazo: isoPrazo }, hoje)
  const quando = situacao === 'na-senior' ? 'na sênior' : situacao === 'encerrado' ? 'encerrado' : c.proxima <= hoje ? 'hoje' : `lembrete ${dataCurta(c.proxima, hoje)}`

  async function agir(acao: () => Promise<ComplementoNaTela>, ok: string) {
    if (travado.current) return
    travado.current = true
    setErro('')
    try {
      setC(await acao())
      setAberto(null)
      setAviso(ok)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Pedir complemento ao médico · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${processo.numero ? `Processo ${processo.numero} · ` : ''}${ficha.nome}`} inicio={perfil?.inicio ?? '/'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.21M · Complemento da documentação médica (passo do BPMN)">
                D1.21M
              </span>
              <span className={styles.codigo} title="D1.23 · Cobrança de pendentes (passo do BPMN)">
                D1.23
              </span>
              <span className={styles.codigo}>Atendimento</span>
              <span className={styles.beneficio}>◆ {beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Pedir complemento ao médico
            </h1>
            <p className={styles.subtitulo}>
              parecer {nomeDoParecer} · {situacao === 'encerrado' ? 'pedido encerrado' : `${c.tentativa}ª tentativa · ${quando}`}
            </p>
          </div>

          <InstrucoesPasso beneficio={beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId} funcao="Atendimento">
            Peça a {primeiro} que leve ao médico dele a orientação abaixo: o relatório novo precisa responder às perguntas, com as palavras do próprio
            médico, sem que o escritório sugira diagnóstico, CID ou conclusão (G20). São {TENTATIVAS_DE_COBRANCA} tentativas, com {DIAS_ENTRE_COBRANCAS} dias
            entre elas{ultima ? ': esta é a última' : ''}; sem o relatório, sobe para a sênior decidir (G15). Quando o relatório chegar, anexe aqui: ele sobe como
            laudo novo e o Jurídico confere.
            {complemento.prazo && ` O prazo do ${complemento.prazo.de} vence em ${dataCurta(complemento.prazo.data, hoje)}: o pedido é urgente e se ajusta para caber nele.`}
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          {situacao === 'encerrado' ? (
            <section className={styles.feito} aria-labelledby="encerrado">
              <h2 id="encerrado" className={styles.feitoTitulo}>
                ✓ Complemento encerrado
              </h2>
              <p>O Jurídico conferiu o documento novo e refez o parecer como Suficiente. Os lembretes foram cancelados.</p>
            </section>
          ) : (
            <p className={proprio.frase}>Enviar ao cliente a orientação para levar ao médico.</p>
          )}

          <section className={styles.cartao} aria-labelledby="resultado">
            <h2 id="resultado" className={styles.cartaoTitulo}>
              Resultado do parecer
            </h2>
            <p>
              <span className={parecer[complemento.parecer]}>{nomeDoParecer.toUpperCase()}</span> confirmado por {complemento.quem} em{' '}
              {dataCurta(hojeIso(new Date(complemento.abertaEm)), hoje)} (G17).
            </p>
            <p className={proprio.detalhe}>O conteúdo clínico (CID, texto dos laudos) fica com o Jurídico. Aqui está só o que falta pedir.</p>
          </section>

          <section className={styles.cartao} aria-labelledby="orientacao">
            <h2 id="orientacao" className={styles.cartaoTitulo}>
              Orientação para levar ao médico
            </h2>
            <ol className={proprio.lista} aria-label="Perguntas ao médico">
              {complemento.perguntas.map((p, i) => (
                <li key={p}>
                  {i + 1}. {p}
                </li>
              ))}
            </ol>
            <pre className={parecer.orientacao} aria-label="Orientação completa">
              {c.orientacao}
            </pre>
            <p className={proprio.detalhe}>Escrita pela IA e confirmada pela advogada. Diz só o que o relatório precisa abordar, sem diagnóstico, CID, grau, conclusão nem frase pronta (G20).</p>
            <button type="button" className={styles.atalho} onClick={() => window.print()}>
              Imprimir a orientação
            </button>
          </section>

          {previa && (
            <section className={styles.cartao} aria-labelledby="previa">
              <h2 id="previa" className={styles.cartaoTitulo}>
                O documento novo chegou · prévia da IA
              </h2>
              <p>
                A IA comparou {previa.documentos.join(', ')} com o pedido:{' '}
                {previa.faltam.length === 0
                  ? 'responde a tudo o que foi pedido. Já está com o Jurídico para conferir.'
                  : `responde a ${previa.respondidas.length} de ${previa.respondidas.length + previa.faltam.length} perguntas. Continue pedindo ao cliente e ao médico o que falta.`}
              </p>
              {previa.faltam.length > 0 && (
                <ul className={proprio.lista} aria-label="Ainda falta">
                  {previa.faltam.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              )}
              <p className={proprio.detalhe}>A palavra final é da advogada (G17).</p>
            </section>
          )}

          {situacao !== 'encerrado' && (
            <p className={styles.aviso}>
              O pedido tem limite de {TENTATIVAS_DE_COBRANCA} tentativas, com {DIAS_ENTRE_COBRANCAS} dias entre elas; passou dele, sobe para a sênior decidir (G15).
            </p>
          )}
          {situacao === 'na-senior' && <p className={styles.trava}>Passou do limite: a sênior decide. O pedido continua à vista aqui.</p>}

          {((complemento.tentativas?.length ?? 0) > 0 || (complemento.decisoes?.length ?? 0) > 0) && (
            <section className={styles.cartao} aria-labelledby="tentativas">
              <h2 id="tentativas" className={styles.cartaoTitulo}>
                Tentativas
              </h2>
              <ul className={proprio.lista} aria-label="Tentativas do pedido">
                {(complemento.tentativas ?? []).map((t, i) => (
                  <li key={`t-${i}`}>
                    {i + 1}ª · {dataCurta(t.dia, hoje)} · {CANAIS[t.canal]} · {RESULTADOS[t.resultado]}
                  </li>
                ))}
                {(complemento.decisoes ?? []).map((d, i) => (
                  <li key={`d-${i}`}>
                    {dataCurta(hojeIso(new Date(d.quando)), hoje)} · decisão da sênior: nova tentativa{d.prazo && ` até ${dataCurta(d.prazo, hoje)}`} · {d.justificativa}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {situacao === 'na-senior' && senior && (
            <section className={styles.cartao} aria-labelledby="decisao-senior">
              <h2 id="decisao-senior" className={styles.cartaoTitulo}>
                Decisão da sênior
              </h2>
              <div className={proprio.formulario}>
                <label>
                  Novo prazo (dd/mm/aaaa)
                  <input inputMode="numeric" maxLength={10} placeholder="dd/mm/aaaa" value={prazo} onChange={(e) => setPrazo(e.target.value)} onBlur={() => setPrazo(normalizarData(prazo))} />
                </label>
              </div>
              <label className={parecer.campo}>
                Justificativa *
                <textarea className={proprio.justificativa} rows={2} maxLength={300} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              </label>
              <div className={styles.rodape}>
                <button
                  type="button"
                  className={styles.principalBotao}
                  disabled={motivoDecidir !== null}
                  onClick={() =>
                    agir(
                      () => decidirComplemento(processoId, { justificativa, prazo: isoPrazo! }, { perfil: perfil?.id, nome: perfil?.usuario ?? 'Sênior' }),
                      'Nova tentativa registrada: o pedido volta para o Atendimento.',
                    )
                  }
                >
                  Nova tentativa com prazo
                </button>
                <a className={proprio.secundario} href={`/casos/${processoId}/parecer/dispensa`}>
                  Dispensar o parecer (duas sêniores)
                </a>
                {motivoDecidir && <p className={styles.motivo}>{motivoDecidir}</p>}
              </div>
            </section>
          )}

          {situacao !== 'encerrado' && (
            <>
              <section className={styles.cartao} aria-labelledby="contato">
                <h2 id="contato" className={styles.cartaoTitulo}>
                  Contato do cliente
                </h2>
                <div className={proprio.contato}>
                  <span className={proprio.pessoa}>
                    <span className={proprio.nome}>{ficha.nome}</span>
                    <span className={proprio.detalhe}>{ficha.telefone ? formatarTelefone(ficha.telefone) : 'sem telefone: complete na ficha'}</span>
                  </span>
                  <span className={styles.atalhos}>
                    <button type="button" className={proprio.botao} disabled={parado} aria-expanded={aberto === 'ligar'} onClick={() => setAberto(aberto === 'ligar' ? null : 'ligar')}>
                      Ligar
                    </button>
                    <button type="button" className={proprio.botao} disabled={parado} onClick={() => setAberto('chatwoot')}>
                      Chatwoot
                    </button>
                  </span>
                </div>
                {aberto === 'ligar' && (
                  <div className={proprio.formulario}>
                    <div className={styles.opcoes} role="radiogroup" aria-label="Como foi a ligação">
                      {(['respondeu', 'sem-resposta'] as const).map((r) => (
                        <button key={r} type="button" role="radio" aria-checked={resultado === r} className={styles.chip} onClick={() => setResultado(r)}>
                          {r === 'respondeu' ? 'Atendeu: vai levar ao médico' : 'Não atendeu (caixa postal ou sem resposta)'}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={proprio.botao}
                      disabled={!resultado}
                      onClick={() =>
                        agir(() => registrarTentativaDoComplemento(processoId, { canal: 'ligacao', resultado: resultado! }), `Ligação registrada como ${c.tentativa}ª tentativa.`)
                      }
                    >
                      Registrar ligação
                    </button>
                  </div>
                )}
              </section>

              <button type="button" className={proprio.anexar} onClick={() => setAberto('anexar')}>
                <span className={proprio.seta} aria-hidden="true">
                  ⬆
                </span>
                <span className={proprio.anexarTitulo}>Anexar o documento recebido</span>
                <span className={proprio.anexarSub}>Arraste o arquivo ou clique para anexar (PDF, foto): o relatório sobe como laudo novo</span>
              </button>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={parado} onClick={() => setAberto('chatwoot')}>
                  Enviar orientação
                </button>
                {situacao === 'aberto' && c.motivoParado && <p className={styles.motivo}>{c.motivoParado}</p>}
              </div>
            </>
          )}
          {erro && (
            <p role="alert" className={styles.motivo}>
              {erro}
            </p>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede nos passos D1.21M e D1.23.</p>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <ul className={styles.ladoLista}>
            <li>• A orientação não sugere diagnóstico, CID, grau nem conclusão (G20)</li>
            <li>• {TENTATIVAS_DE_COBRANCA} tentativas, {DIAS_ENTRE_COBRANCAS} dias entre elas; depois, a sênior (G15)</li>
          </ul>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>O relatório sobe como laudo novo; a IA compara e a advogada refaz o parecer. Com o Suficiente, o pedido se encerra.</p>
        </aside>
      </main>
      <AbaSuporte />
      {aberto === 'chatwoot' && (
        <ConviteChatwoot
          agendamentoId={processoId}
          assunto="complemento"
          aoEnviado={async () => {
            setAberto(null)
            setC(await obterComplemento(processoId))
            setAviso('Orientação enviada pelo Chatwoot e registrada como tentativa.')
          }}
          aoFechar={() => setAberto(null)}
        />
      )}
      {aberto === 'anexar' && (
        <ConferirEnviar
          fichaId={ficha.id}
          origem="card"
          aoEnviar={async (r) => {
            setAberto(null)
            setC(await obterComplemento(processoId))
            setAviso(
              `${r.arquivos.length === 1 ? '1 arquivo enviado' : `${r.arquivos.length} arquivos enviados`} para a pasta do cliente.${r.laudoNovo ? ' Laudo novo enviado ao Jurídico: a IA já comparou com o pedido.' : ''}`,
            )
          }}
          aoFechar={() => setAberto(null)}
        />
      )}
    </>
  )
}
