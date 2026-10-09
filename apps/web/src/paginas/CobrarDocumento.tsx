import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { ConferirEnviar } from '../componentes/ConferirEnviar.tsx'
import { ConviteChatwoot } from '../componentes/ConviteChatwoot.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { dataParaIso, formatarTelefone, normalizarData } from '../campos.ts'
import { adiarCobranca, obterCobranca, registrarTentativa, type CobrancaDoCaso } from '../dados/cobranca.ts'
import { agora } from '../dados/servidor.ts'
import { CANAIS, DIAS_ENTRE_COBRANCAS, OPCOES_DA_SENIOR, RESULTADOS, TENTATIVAS_DE_COBRANCA, motivoParaNaoAdiar, type TentativaDeCobranca } from '../regras/cobranca.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './Cobranca.module.css'

// Figma: step_D1.23 "Cobrar documento · pendentes do checklist" (2106:3), no visual das telas de passo (GGVP-101).

type Aberto = 'chatwoot' | 'ligar' | 'adiar' | 'anexar' | null

export function CobrarDocumento({ processoId }: { processoId: string }) {
  // undefined: abrindo; null: o caso não tem cobrança.
  const [c, setC] = useState<CobrancaDoCaso | null | undefined>(undefined)
  const [aberto, setAberto] = useState<Aberto>(null)
  const [resultado, setResultado] = useState<TentativaDeCobranca['resultado'] | null>(null)
  const [novaData, setNovaData] = useState('')
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterCobranca(processoId).then((x) => {
      if (valendo) setC(x)
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!c) {
    return (
      <main className={proprio.vazia}>
        <title>Cobrar documento · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{c === null ? 'Este caso não tem cobrança aberta' : 'Abrindo a cobrança…'}</h1>
        {c === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, beneficio, faltam, cobranca, situacao } = c
  const hoje = hojeIso(agora())
  const ultima = c.tentativa === TENTATIVAS_DE_COBRANCA
  const quando = situacao === 'na-senior' ? 'na sênior' : c.proxima <= hoje ? 'vence hoje' : `lembrete ${dataCurta(c.proxima, hoje)}`
  const parado = situacao !== 'aberta' || c.motivoParado !== null
  const isoAdiar = dataParaIso(novaData)
  const motivoAdiar = motivoParaNaoAdiar(isoAdiar, hoje, cobranca.prazo)

  async function agir(acao: () => Promise<CobrancaDoCaso>, ok: string) {
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
      <title>{`${ficha.nome} · Cobrar documento · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${processo.numero ? `Processo ${processo.numero} · ` : ''}${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.23 · Cobrança de pendentes (passo do BPMN)">
                D1.23
              </span>
              <span className={styles.codigo}>Atendimento</span>
              <span className={styles.beneficio}>◆ {beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Cobrar documento
            </h1>
            <p className={styles.subtitulo}>
              {faltam.length === 0 ? 'nada pendente' : `${faltam.length === 1 ? '1 documento pendente' : `${faltam.length} documentos pendentes`}`} ·{' '}
              {situacao === 'encerrada' ? 'cobrança fechada' : `${c.tentativa}ª tentativa · ${quando}`}
            </p>
          </div>

          <InstrucoesPasso beneficio={beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId} funcao="Atendimento">
            Cobre de {ficha.nome.split(' ')[0]} o que falta no checklist do {beneficio} (G1). É a {c.tentativa}ª{ultima ? ' e última' : ''} tentativa: são{' '}
            {TENTATIVAS_DE_COBRANCA}, com {DIAS_ENTRE_COBRANCAS} dias entre elas; sem resposta, sobe para a sênior decidir (G15).
            {cobranca.prazo &&
              ` O prazo do ${cobranca.prazo.de} vence em ${dataCurta(cobranca.prazo.data, hoje)}: as tentativas se ajustam para caber nele, e a tarefa é urgente.`}
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          {situacao === 'encerrada' ? (
            <section className={styles.feito} aria-labelledby="fechada">
              <h2 id="fechada" className={styles.feitoTitulo}>
                {cobranca.encerrada?.porque === 'suspensa' ? 'Caso suspenso pela sênior' : '✓ Chegou tudo o que faltava'}
              </h2>
              <p>
                {cobranca.encerrada?.porque === 'suspensa'
                  ? `Justificativa: ${cobranca.decisoes.at(-1)?.justificativa}.`
                  : 'A cobrança fechou sozinha e os lembretes foram cancelados.'}
              </p>
            </section>
          ) : (
            <p className={proprio.frase}>Enviar a mensagem de cobrança dos documentos pendentes ao cliente.</p>
          )}

          <section className={styles.cartao} aria-labelledby="pendentes">
            <h2 id="pendentes" className={styles.cartaoTitulo}>
              Pendentes no checklist
            </h2>
            {faltam.length > 0 ? (
              <ul className={proprio.lista} aria-label="Documentos pendentes">
                {faltam.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            ) : (
              <p className={proprio.detalhe}>Nada falta.</p>
            )}
            {situacao === 'aberta' && (
              <p className={proprio.detalhe}>
                Próximo lembrete: {c.proxima <= hoje ? 'hoje' : dataCurta(c.proxima, hoje)}
                {cobranca.prazo && ` · prazo do ${cobranca.prazo.de}: ${dataCurta(cobranca.prazo.data, hoje)}`}
              </p>
            )}
            <a className={styles.atalho} href={`/casos/${processoId}/checklist`}>
              Abrir o checklist
            </a>
          </section>

          <p className={styles.aviso}>
            A cobrança tem limite de {TENTATIVAS_DE_COBRANCA} tentativas, com {DIAS_ENTRE_COBRANCAS} dias entre elas; passou dele, sobe para a sênior decidir (G15).
          </p>
          {situacao === 'na-senior' && (
            <p className={styles.trava}>Passou do limite: a sênior decide o que fazer. A cobrança continua à vista aqui.</p>
          )}

          {(cobranca.tentativas.length > 0 || cobranca.decisoes.length > 0) && (
            <section className={styles.cartao} aria-labelledby="tentativas">
              <h2 id="tentativas" className={styles.cartaoTitulo}>
                Tentativas
              </h2>
              <ul className={proprio.lista} aria-label="Tentativas de cobrança">
                {cobranca.tentativas.map((t, i) => (
                  <li key={`t-${i}`}>
                    {i + 1}ª · {dataCurta(t.dia, hoje)} · {CANAIS[t.canal]} · {RESULTADOS[t.resultado]}
                  </li>
                ))}
                {cobranca.decisoes.map((d, i) => (
                  <li key={`d-${i}`}>
                    {dataCurta(hojeIso(new Date(d.quando)), hoje)} · decisão da sênior: {OPCOES_DA_SENIOR[d.opcao].toLowerCase()}
                    {d.prazo && ` até ${dataCurta(d.prazo, hoje)}`} · {d.justificativa}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {situacao !== 'encerrada' && (
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
                          {r === 'respondeu' ? 'Atendeu: vai mandar' : 'Não atendeu (caixa postal ou sem resposta)'}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={proprio.botao}
                      disabled={!resultado}
                      onClick={() => agir(() => registrarTentativa(processoId, { canal: 'ligacao', resultado: resultado! }), `Ligação registrada como ${c.tentativa}ª tentativa.`)}
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
                <span className={proprio.anexarSub}>Arraste o arquivo ou clique para anexar (PDF, foto)</span>
              </button>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={parado} onClick={() => setAberto('chatwoot')}>
                  Enviar cobrança
                </button>
                <button type="button" className={proprio.secundario} disabled={situacao !== 'aberta'} aria-expanded={aberto === 'adiar'} onClick={() => setAberto(aberto === 'adiar' ? null : 'adiar')}>
                  Adiar
                </button>
                {situacao === 'aberta' && c.motivoParado && <p className={styles.motivo}>{c.motivoParado}</p>}
              </div>

              {aberto === 'adiar' && (
                <div className={proprio.formulario}>
                  <label>
                    Nova data (obrigatória)
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="dd/mm/aaaa"
                      value={novaData}
                      onChange={(e) => setNovaData(e.target.value)}
                      onBlur={() => setNovaData(normalizarData(novaData))}
                    />
                  </label>
                  <button
                    type="button"
                    className={proprio.botao}
                    disabled={motivoAdiar !== null}
                    onClick={() => agir(() => adiarCobranca(processoId, isoAdiar), `Cobrança adiada para ${isoAdiar ? dataCurta(isoAdiar, hoje) : ''}; a contagem de tentativas continua.`)}
                  >
                    Adiar a cobrança
                  </button>
                  {novaData && motivoAdiar && <p className={styles.motivo}>{motivoAdiar}</p>}
                </div>
              )}
            </>
          )}
          {erro && (
            <p role="alert" className={styles.motivo}>
              {erro}
            </p>
          )}
        </div>
      </main>
      <AbaSuporte />
      {aberto === 'chatwoot' && (
        // O id da conversa é o do processo: a janela é a mesma do convite e da confirmação.
        <ConviteChatwoot
          agendamentoId={processoId}
          assunto="cobranca"
          aoEnviado={async () => {
            setAberto(null)
            setC(await obterCobranca(processoId))
            setAviso('Cobrança enviada pelo Chatwoot e registrada como tentativa.')
          }}
          aoFechar={() => setAberto(null)}
        />
      )}
      {aberto === 'anexar' && (
        <ConferirEnviar
          fichaId={ficha.id}
          origem="card"
          aoEnviar={(r) => {
            setAberto(null)
            setAviso(
              `${r.arquivos.length === 1 ? '1 arquivo enviado' : `${r.arquivos.length} arquivos enviados`} para a pasta do cliente: a Documentação confere a leitura e o checklist é conferido de novo.`,
            )
          }}
          aoFechar={() => setAberto(null)}
        />
      )}
    </>
  )
}
