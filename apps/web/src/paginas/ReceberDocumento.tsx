import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { AntesDeConcluirRecebimento } from '../componentes/AntesDeConcluirRecebimento.tsx'
import { ConferirEnviar } from '../componentes/ConferirEnviar.tsx'
import { InstrucoesRecebimento } from '../componentes/InstrucoesRecebimento.tsx'
import { ResultadoLote } from '../componentes/ResultadoLote.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { obterTarefa, receberLote, registrarRecebimento } from '../dados/documentos.ts'
import type { Ficha, LoteDigitalizado, TarefaEncaminhada } from '../dados/tipos.ts'
import { hora } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './ReceberDocumento.module.css'

// Figma: step_D1.02 "Balcão · Receber documento" (10:440). Usa o visual das telas de passo do balcão.

type Forma = 'papel' | 'digital'

export function ReceberDocumento({ tarefaId }: { tarefaId: string }) {
  const [dados, setDados] = useState<{ tarefa: TarefaEncaminhada; ficha: Ficha } | null | undefined>(undefined)
  const [forma, setForma] = useState<Forma | null>(null)
  const [lote, setLote] = useState<LoteDigitalizado | undefined>()
  const [digitalizando, setDigitalizando] = useState(false)
  const [janela, setJanela] = useState(false)
  const [anexados, setAnexados] = useState(0)
  const [conferiTipos, setConferiTipos] = useState(false)
  const [conferiPapel, setConferiPapel] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterTarefa(tarefaId).then((d) => {
      if (!valendo) return
      setDados(d)
      if (d?.tarefa.lote) {
        setForma('papel')
        setLote(d.tarefa.lote)
      }
    })
    return () => {
      valendo = false
    }
  }, [tarefaId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Receber documento · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Tarefa não encontrada' : 'Abrindo a tarefa…'}</h1>
        {dados === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { tarefa, ficha } = dados
  const caso = ficha.processos.find((p) => p.id === tarefa.processoId)
  const recebido = forma === 'papel' ? lote !== undefined : forma === 'digital' && anexados > 0
  const motivoParado = tarefa.concluida
    ? 'Esta tarefa já foi registrada.'
    : !forma
      ? 'Escolha se chegou em papel ou digital.'
      : !recebido
        ? forma === 'papel'
          ? 'Digitalize a pilha no scanner.'
          : 'Anexe os arquivos ao card.'
        : !conferiTipos
          ? 'Confira o tipo de cada documento.'
          : lote?.conferirPapel && forma === 'papel' && !conferiPapel
            ? 'Confira o papel antes de devolver o original.'
            : null

  async function digitalizar() {
    setDigitalizando(true)
    try {
      setLote(await receberLote(tarefaId))
    } finally {
      setDigitalizando(false)
    }
  }

  async function registrar() {
    if (travado.current || motivoParado || !forma) return
    travado.current = true
    setRegistrando(true)
    setErro('')
    try {
      const { evento } = await registrarRecebimento(tarefaId, { forma, conferiTipos: true, conferiPapel })
      setFeito(evento.quando)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setRegistrando(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Receber documento · GGV Previdenciário`}</title>
      <TopoPasso contexto="Balcão" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.02 · Receber documento (passo do BPMN)">
                D1.02
              </span>
              <span className={styles.codigo}>Documentação</span>
              <span className={styles.codigo}>{tarefa.prazo ?? '—'}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Receber documento
            </h1>
            <p className={styles.subtitulo}>Cliente entregou documentos · {tarefa.detalhe}</p>
          </div>

          <InstrucoesRecebimento fichaId={ficha.id} beneficio={caso ? nomeBeneficio(caso.beneficio) : ''} />

          {feito ? (
            <section className={styles.feito} aria-labelledby="registrado">
              <h2 id="registrado" className={styles.feitoTitulo}>
                ✓ Registrado às {hora(feito)}
              </h2>
              <p>O recebimento ficou no histórico da ficha de {ficha.nome} e a tarefa saiu da Central.</p>
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
              <section className={styles.cartao} aria-labelledby="papel-ou-digital">
                <h2 id="papel-ou-digital" className={styles.cartaoTitulo}>
                  Chegou em papel ou digital?
                </h2>
                <div className={styles.opcoes} role="radiogroup" aria-labelledby="papel-ou-digital">
                  {(['papel', 'digital'] as const).map((f) => (
                    <button key={f} type="button" role="radio" aria-checked={forma === f} className={styles.opcao} onClick={() => setForma(f)}>
                      {f === 'papel' ? 'Papel — vai ao scanner' : 'Digital — anexar ao card'}
                    </button>
                  ))}
                </div>
              </section>

              {forma === 'papel' && (
                <section className={styles.cartao} aria-labelledby="scanner">
                  <h2 id="scanner" className={styles.cartaoTitulo}>
                    Scanner
                  </h2>
                  {lote ? (
                    <ResultadoLote lote={lote} fichaId={ficha.id} />
                  ) : (
                    <>
                      <p className={proprio.texto}>
                        Ponha a pilha deste cliente no scanner (uma pilha por cliente, de até umas 20 folhas) e aperte
                        DIGITALIZAR. O PDF chega pesquisável na pasta dele no Drive.
                      </p>
                      <button type="button" className={styles.atalho} disabled={digitalizando} onClick={digitalizar}>
                        {digitalizando ? 'aguardando o lote…' : 'Digitalizar (scanner simulado)'}
                      </button>
                    </>
                  )}
                </section>
              )}

              {forma === 'digital' && (
                <section className={styles.cartao} aria-labelledby="anexar">
                  <h2 id="anexar" className={styles.cartaoTitulo}>
                    Anexar ao card
                  </h2>
                  <p className={proprio.texto}>
                    {anexados === 0
                      ? 'Os arquivos vão para a pasta do cliente no Drive, conferidos um a um.'
                      : `${anexados === 1 ? '1 arquivo anexado' : `${anexados} arquivos anexados`} ao card.`}
                  </p>
                  <button type="button" className={styles.atalho} onClick={() => setJanela(true)}>
                    Anexar ao card
                  </button>
                </section>
              )}

              {recebido && (
                <section className={styles.cartao} aria-labelledby="conferencias">
                  <h2 id="conferencias" className={styles.cartaoTitulo}>
                    Conferências
                  </h2>
                  <label className={proprio.conferencia}>
                    <input type="checkbox" checked={conferiTipos} onChange={(e) => setConferiTipos(e.target.checked)} />
                    Conferi o tipo de cada documento
                  </label>
                  {forma === 'papel' && lote?.conferirPapel && (
                    <label className={proprio.conferencia}>
                      <input type="checkbox" checked={conferiPapel} onChange={(e) => setConferiPapel(e.target.checked)} />
                      Conferi o papel: todas as folhas passaram e posso devolver o original
                    </label>
                  )}
                </section>
              )}

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={motivoParado !== null || registrando} onClick={registrar}>
                  {registrando ? 'registrando…' : 'Registrar'}
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
        <AntesDeConcluirRecebimento forma={forma} conferirPapel={forma === 'papel' && lote?.conferirPapel === true} />
      </main>
      <AbaSuporte />
      {janela && (
        <ConferirEnviar
          fichaId={ficha.id}
          origem="card"
          aoEnviar={(r) => {
            setJanela(false)
            setAnexados((n) => n + r.arquivos.length)
          }}
          aoFechar={() => setJanela(false)}
        />
      )}
    </>
  )
}
