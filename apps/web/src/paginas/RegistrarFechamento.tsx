import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CabecalhoDoPasso } from '../componentes/CabecalhoDoPasso.tsx'
import { CampoDoRecontato, CamposDoMotivo } from '../componentes/CamposDoFechamento.tsx'
import { ResumoDoFechamento } from '../componentes/CartaoFechamento.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { nomeBeneficio, nomeMotivo } from '../dados/catalogos.ts'
import { obterFechamento, registrarFechamento, type DadosDoFechamento } from '../dados/fechamento.ts'
import { agora } from '../dados/servidor.ts'
import type { EsperaDoRecontato, PapelNoFechamento } from '../dados/tipos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { calculoPendente } from '../regras/calculo.ts'
import { DIAS_PARA_ESPERAR, DIAS_PARA_PENSAR, beneficioDoFechamento, erroDoRecontato, motivoParadoDoFechamento } from '../regras/fechamento.ts'
import { demandaAberta, nomeDaSubpasta } from '../regras/novaDemanda.ts'
import styles from './Balcao.module.css'
import proprio from './RegistrarFechamento.module.css'

// Figma: step_D1.14 "Registrar fechamento" (10:112). As decisões "Fechou com o escritório?" e "Vale recontatar numa data
// prevista?" ficam no painel, como no desenho; o cartão pede, além dele, quem registra a recusa do escritório (CA11) e a
// sugestão da data pelo "ficou de pensar" ou "pediu para esperar" (CA12).

export function RegistrarFechamento({ fichaId }: { fichaId: string }) {
  const hoje = hojeIso(agora())
  const [dados, setDados] = useState<DadosDoFechamento | null | undefined>(undefined)
  const [fechou, setFechou] = useState<boolean | null>(null)
  const [motivo, setMotivo] = useState('')
  const [detalhe, setDetalhe] = useState('')
  const [papel, setPapel] = useState<PapelNoFechamento>('atendimento')
  const [recontatar, setRecontatar] = useState<boolean | null>(null)
  const [data, setData] = useState('')
  const [espera, setEspera] = useState<EsperaDoRecontato | null>(null)
  const [erroData, setErroData] = useState<string | undefined>()
  const [registrando, setRegistrando] = useState(false)
  const [registrado, setRegistrado] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterFechamento(fichaId).then((d) => {
      if (valendo) setDados(d)
    })
    return () => {
      valendo = false
    }
  }, [fichaId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Registrar fechamento · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Ficha não encontrada' : 'Abrindo a tarefa…'}</h1>
        {dados === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, entrevista } = dados
  const beneficio = beneficioDoFechamento(ficha)
  // O cliente responde pela nova demanda (GGVP-124): sem recontato; "Não fechou" encerra a demanda com o motivo.
  // O lead que acabou de fechar já é cliente, mas segue nesta tela pelo fechamento dele.
  const porDemanda = ficha.situacao === 'cliente' && (ficha.fechamento?.situacao !== 'fechou' || (ficha.demandas?.length ?? 0) > 0)
  const demanda = porDemanda ? (demandaAberta(ficha) ?? ficha.demandas?.at(-1)) : undefined
  const pendente = porDemanda ? demanda?.situacao === 'aberta' : !ficha.fechamento || ficha.fechamento.situacao === 'recalcular'
  const motivoParado = motivoParadoDoFechamento({ fechou, motivo, detalhe, papel, recontatar: porDemanda ? false : recontatar, data, beneficio, calculoPendente: !porDemanda && calculoPendente(ficha) }, hoje)
  const primeiro = ficha.nome.split(' ')[0]
  const subtitulo =
    fechou === true
      ? 'fechou · segue para o kit do benefício'
      : fechou === false
        ? 'não fechou · por que não virou cliente'
        : `depois da entrevista${entrevista ? ` de ${dataCurta(entrevista.data, hoje)}` : ''} · fechou com o escritório?`
  const botao =
    fechou === true
      ? 'Registrar fechamento'
      : porDemanda
        ? 'Registrar e encerrar a demanda'
        : recontatar === false
          ? 'Registrar e arquivar o lead'
          : 'Registrar e agendar retorno'

  function mudarMotivo(campo: 'motivo' | 'detalhe' | 'papel', valor: string) {
    if (campo === 'motivo') setMotivo(valor)
    else if (campo === 'detalhe') setDetalhe(valor)
    else setPapel(valor as PapelNoFechamento)
  }

  async function registrar() {
    if (travado.current || motivoParado || fechou === null) return
    travado.current = true
    setRegistrando(true)
    setErro('')
    try {
      const r = await registrarFechamento(
        fichaId,
        fechou ? { fechou: true } : { fechou: false, motivo, detalhe, papel, recontatar: recontatar ? { data, ...(espera && { espera }) } : null },
      )
      setDados({ ...dados!, ficha: r.ficha })
      setRegistrado(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setRegistrando(false)
    }
  }

  const f = ficha.fechamento
  return (
    <>
      <title>{`${ficha.nome} · Registrar fechamento · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${ficha.situacao === 'lead' ? 'Lead' : 'Cliente'} · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <CabecalhoDoPasso
            passo="D1.14"
            nomeDoPasso="Registrar o fechamento e o motivo"
            setor="Atendimento"
            tarefa="Registrar fechamento"
            subtitulo={subtitulo}
            ficha={ficha}
            beneficio={beneficio}
            instrucoes={
              'Registre o motivo real: preço, desistiu, não tem direito, foi a outro escritório, sem retorno, contato inválido, fez o ' +
              'processo sozinho, falecido ou recusado pelo escritório. Quando o escritório recusa o caso, quem registra é o Atendimento ' +
              `sênior ou o advogado do atendimento. Se ficou de pensar, o recontato sugerido é em ${DIAS_PARA_PENSAR} dias; se pediu para ` +
              `esperar, em ${DIAS_PARA_ESPERAR}. Sem motivo registrado o lead não pode ser encerrado (G16).`
            }
          />

          {!pendente && porDemanda ? (
            demanda ? (
              <section className={registrado ? styles.feito : styles.cartao} aria-labelledby="registrado">
                <h2 id="registrado" className={registrado ? styles.feitoTitulo : styles.cartaoTitulo}>
                  {demanda.situacao === 'fechou'
                    ? `✓ Fechou: ${nomeBeneficio(beneficio)} é processo novo na mesma ficha`
                    : '✓ Nova demanda encerrada com o motivo'}
                </h2>
                <p>
                  {demanda.situacao === 'fechou'
                    ? `Segue para o kit do benefício (D1.15), com a subpasta «${nomeDaSubpasta(beneficio!, hoje)}» na pasta do cliente.`
                    : `${nomeMotivo(demanda.motivo)}${demanda.detalhe ? ` (${demanda.detalhe})` : ''}. ${primeiro} segue cliente nos outros processos.`}
                </p>
                <div className={styles.atalhos}>
                  <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                    Abrir a ficha do cliente
                  </a>
                  <a className={styles.atalho} href="/">
                    Voltar ao início
                  </a>
                </div>
              </section>
            ) : (
              <p className={styles.aviso}>
                Não há nova demanda aberta para {primeiro}.{' '}
                <a className={styles.avisoLink} href={`/clientes/${ficha.id}/nova-demanda`}>
                  Abrir a nova demanda
                </a>
              </p>
            )
          ) : !pendente && f ? (
            <section className={registrado ? styles.feito : styles.cartao} aria-labelledby="registrado">
              <h2 id="registrado" className={registrado ? styles.feitoTitulo : styles.cartaoTitulo}>
                {f.situacao === 'fechou'
                  ? `✓ Fechou com o escritório: ${primeiro} é cliente`
                  : f.situacao === 'recontatar'
                    ? `✓ Registrado: recontatar em ${dataCurta(f.recontatarEm!, hoje)}`
                    : '✓ Lead arquivado com o motivo'}
              </h2>
              <p>
                {f.situacao === 'fechou'
                  ? `${nomeBeneficio(beneficio)}: segue para o kit do benefício (D1.15).`
                  : f.situacao === 'recontatar'
                    ? 'O recontato está na agenda, e a tarefa "Recontatar lead" aparece na Central nesse dia.'
                    : 'Saiu das filas ativas e continua pesquisável no balcão, com o motivo e o histórico.'}
              </p>
              <ResumoDoFechamento fechamento={f} hoje={hoje} />
              <div className={styles.atalhos}>
                <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                  Abrir a ficha do cliente
                </a>
                <a className={styles.atalho} href="/">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : (
            <>
              {!porDemanda && f?.situacao === 'recalcular' && (
                <p className={styles.aviso}>
                  Voltou do recontato ao cálculo de tempo e pontos (motivo de antes: {nomeMotivo(f.motivo) || 'sem motivo'}). Registre de novo se
                  fechou.
                </p>
              )}
              {fechou === true ? (
                <section className={styles.cartao} aria-labelledby="fechou">
                  <h2 id="fechou" className={styles.cartaoTitulo}>
                    Fechou com o escritório
                  </h2>
                  {beneficio && beneficio !== 'nao-sei' && porDemanda ? (
                    <p className={proprio.texto}>
                      Processo novo de {nomeBeneficio(beneficio)}, o benefício que a advogada definiu, na mesma ficha: número novo, kit novo
                      (contrato e procuração) e a subpasta «{nomeDaSubpasta(beneficio, hoje)}». Os documentos pessoais que já estão na pasta
                      não são pedidos de novo.
                    </p>
                  ) : beneficio && beneficio !== 'nao-sei' ? (
                    <p className={proprio.texto}>
                      {primeiro} vira cliente com {nomeBeneficio(beneficio)}, o benefício que a advogada definiu, e o caso segue para o kit do
                      benefício (D1.15).
                    </p>
                  ) : (
                    <p className={styles.aviso}>
                      Falta o benefício definido pela advogada.{' '}
                      {entrevista && (
                        <a className={styles.avisoLink} href={`/entrevista/${entrevista.id}/beneficio`}>
                          Definir o benefício (D1.12)
                        </a>
                      )}
                    </p>
                  )}
                </section>
              ) : (
                <section className={styles.cartao} aria-labelledby="preencher">
                  <h2 id="preencher" className={styles.cartaoTitulo}>
                    Preencher
                  </h2>
                  <div className={proprio.campos}>
                    <CamposDoMotivo motivo={motivo} detalhe={detalhe} papel={papel} aoMudar={mudarMotivo} />
                    {recontatar !== false && !porDemanda && (
                      <CampoDoRecontato
                        data={data}
                        espera={espera}
                        hoje={hoje}
                        erro={erroData}
                        aoMudar={(d, e) => {
                          setData(d)
                          setEspera(e)
                          setErroData(undefined)
                        }}
                        aoSair={() => setErroData(erroDoRecontato(data, hoje))}
                      />
                    )}
                  </div>
                </section>
              )}

              <p className={styles.trava}>
                {porDemanda ? 'Toda demanda que não fecha fica com o motivo registrado (G16).' : 'Todo lead que não vira cliente fica com o motivo registrado (G16).'}
              </p>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={motivoParado !== null || registrando} onClick={registrar}>
                  {registrando ? 'registrando…' : botao}
                </button>
                {motivoParado && <p className={styles.motivo}>{motivoParado}</p>}
                {erro && (
                  <p role="alert" className={styles.motivo}>
                    {erro}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.14.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <p id="fechou-pergunta">Fechou com o escritório?</p>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="fechou-pergunta">
              <button type="button" role="radio" className={styles.chip} aria-checked={fechou === true} disabled={!pendente} onClick={() => setFechou(true)}>
                Sim, fechou
              </button>
              <button type="button" role="radio" className={styles.chip} aria-checked={fechou === false} disabled={!pendente} onClick={() => setFechou(false)}>
                Não fechou
              </button>
            </div>
          </div>
          {porDemanda ? (
            <p className={styles.ladoSub}>Cliente com nova demanda: sem recontato; «Não fechou» encerra a demanda com o motivo.</p>
          ) : (
            <div className={styles.decisao}>
              <p id="recontatar-pergunta">Se «Não fechou»: Vale recontatar numa data prevista?</p>
              <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="recontatar-pergunta">
                <button
                  type="button"
                  role="radio"
                  className={styles.chip}
                  aria-checked={recontatar === true}
                  disabled={!pendente || fechou !== false}
                  onClick={() => setRecontatar(true)}
                >
                  Sim, agendar recontato
                </button>
                <button
                  type="button"
                  role="radio"
                  className={styles.chip}
                  aria-checked={recontatar === false}
                  disabled={!pendente || fechou !== false}
                  onClick={() => setRecontatar(false)}
                >
                  Não, arquivar o lead
                </button>
              </div>
            </div>
          )}
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>
              • Se «Não fechou»: Motivo* (Preço, Desistiu, Ainda não tem direito, Foi a outro escritório, Sem retorno, Contato inválido, Fez o
              processo sozinho, Falecido, Recusado pelo escritório, Outro)
            </li>
            <li>• Se «Não fechou»: Detalhe do motivo</li>
            <li>
              • Se «Sim, agendar recontato»: Recontatar em* (sugere {DIAS_PARA_PENSAR} dias se ficou de pensar, {DIAS_PARA_ESPERAR} se pediu
              para esperar)
            </li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Registrar e agendar retorno» só habilita com as decisões respondidas e os campos com * preenchidos.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
