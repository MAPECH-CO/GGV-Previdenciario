import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { JurimetriaPerito } from '../componentes/JurimetriaPerito.tsx'
import {
  lerLaudoDaPericia,
  ligarPeritoDoLaudo,
  obterResultado,
  peritosParaLigar,
  registrarResultado,
  type LeituraDoLaudo,
  type PericiaNaTela,
} from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { formatoDoArquivo, hashDoConteudo, problemaDoArquivo } from '../regras/arquivos.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import {
  COMO_SEGUE,
  CONFERENCIAS_DO_RESULTADO,
  DIAS_PARA_MANIFESTAR,
  NOMES_DO_TIPO,
  ORIGENS,
  motivoParaNaoRegistrarResultado,
  prazoParaManifestar,
} from '../regras/pericia.ts'
import styles from './Balcao.module.css'
import proprio from './Pericia.module.css'

// Figma: step_DP.08 · Conferir resultado da perícia (14:556) e Resultado da perícia (1579:431). A IA resume o laudo e, no
// desfavorável, diz por que e se vale nova perícia (Lucas, 02/10); quem decide é a advogada. Os números do perito são do
// sistema (G22). Quesitos, impugnação e manifestação são peças da IA, de outra história (G6).

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export function ResultadoPericia({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Advogada')
  const quem = perfil?.usuario ?? 'Advogada'
  const [t, setT] = useState<PericiaNaTela | null | undefined>(undefined)
  const [laudo, setLaudo] = useState<{ nome: string; tamanho: number; hash: string }>()
  const [leitura, setLeitura] = useState<LeituraDoLaudo>()
  const [favoravel, setFavoravel] = useState<boolean>()
  const [novaPericia, setNovaPericia] = useState<boolean>()
  const [conferidas, setConferidas] = useState<string[]>([])
  const [verPerfil, setVerPerfil] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterResultado(processoId).then((x) => valendo && setT(x))
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!t) {
    return (
      <main className={styles.pagina}>
        <title>Conferir resultado da perícia · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{t === undefined ? 'Abrindo o resultado…' : 'Ainda não há resultado para conferir'}</h1>
        {t !== undefined && <p>O resultado entra aqui depois que o cliente comparece à perícia.</p>}
        {t !== undefined && <a href={`/casos/${processoId}/pericia`}>Ver a perícia</a>}
      </main>
    )
  }

  const { pericia, ficha } = t
  const hoje = hojeIso(agora())
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const m = pericia.marcacao!
  const onde = pericia.instancia === 'inss' ? 'no GERID' : 'no processo'
  const r = pericia.resultado?.registrado
  const lido = leitura ?? pericia.resultado?.laudo?.leitura
  const exigidas = CONFERENCIAS_DO_RESULTADO[pericia.tipo]
  const motivo = motivoParaNaoRegistrarResultado({ laudo: !!laudo, favoravel, novaPericia, conferidas }, exigidas.map((c) => c.id))
  const judicial = pericia.instancia === 'juizo'
  const j = t.perfil?.jurimetria
  const manifestar = judicial ? prazoParaManifestar(hoje) : undefined

  async function anexar(arquivo: File | undefined) {
    if (!arquivo) return
    setErro('')
    const problema = problemaDoArquivo({ nome: arquivo.name, tamanho: arquivo.size })
    if (problema || formatoDoArquivo(arquivo.name) !== 'pdf') return setErro(problema ?? 'O laudo (ou o registro do GERID) é um PDF.')
    const hash = await hashDoConteudo(await arquivo.arrayBuffer())
    setLaudo({ nome: arquivo.name, tamanho: arquivo.size, hash })
    setLeitura(await lerLaudoDaPericia(processoId, arquivo.name))
  }

  async function ligar(peritoId: string) {
    if (travado.current) return
    travado.current = true
    setErro('')
    try {
      const feito = await ligarPeritoDoLaudo(processoId, peritoId, quem)
      setT(feito)
      setAviso(`Laudo ligado a ${feito.perfil?.perito.nome}: o perfil foi atualizado.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para ligar o perito.')
    } finally {
      travado.current = false
    }
  }

  async function registrar() {
    if (travado.current || !laudo) return
    travado.current = true
    setErro('')
    try {
      setT(await registrarResultado(processoId, { laudo: { nome: laudo.nome, hash: laudo.hash }, favoravel, novaPericia, conferidas }, quem))
      setAviso('Resultado registrado.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Conferir resultado da perícia · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${t.processo.numero ? `Processo ${t.processo.numero} · ` : ''}${ficha.nome}`} inicio={perfil?.inicio ?? '/'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="DP.08 · Conferir o resultado da perícia (passo do BPMN)">
                DP.08
              </span>
              <span className={styles.codigo}>Advogada</span>
              <span className={styles.beneficio}>◆ {t.beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Conferir resultado da perícia
            </h1>
            <p className={styles.subtitulo}>
              {pericia.resultado?.disponivelEm || r ? `resultado ${onde}` : `${tipo} feita em ${dataCurta(m.data, hoje)} · esperando o resultado ${onde}`}
            </p>
          </div>

          <InstrucoesPasso beneficio={t.beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId} funcao="Advogada">
            Confira o resultado da {tipo} de {dataCurta(m.data, hoje)} {onde}: anexe o laudo (ou o registro do GERID), leia na íntegra e informe se foi
            favorável. Se foi desfavorável, a IA diz por que e se vale pedir nova perícia, mas quem decide é você. O resultado volta para quem pediu (
            {ORIGENS[pericia.origem].rotulo}).
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          {r ? (
            <section className={styles.feito} aria-labelledby="registrado">
              <h2 id="registrado" className={styles.feitoTitulo}>
                ✓ Resultado registrado: {r.favoravel ? 'favorável' : 'desfavorável'}
              </h2>
              <p>
                Laudo {pericia.resultado!.laudo!.nome} · registrado em {dataHora(r.quando)} por {r.quem}.
              </p>
              {r.novaPericia ? (
                <p>
                  Nova perícia pedida: o Jurídico administrativo marca de novo, sem contar como remarcação.{' '}
                  <a href={`/casos/${processoId}/pericia`}>Ver a nova perícia</a>
                </p>
              ) : (
                <p>
                  O resultado subiu no card e voltou para quem pediu ({ORIGENS[pericia.origem].rotulo}): {COMO_SEGUE[pericia.origem]}
                  {r.manifestarAte && `, até ${dataCurta(r.manifestarAte, hoje)} (${DIAS_PARA_MANIFESTAR} dias, G12)`}.
                </p>
              )}
              <a className={styles.atalho} href={`/casos/${processoId}/pericia`}>
                Ver a página do processo
              </a>
            </section>
          ) : null}

          {/* DP.09 (GGVP-73): o laudo no perfil do perito, ou a pergunta de um clique quando o perito não foi reconhecido. */}
          {r && pericia.resultado!.noPerfil === 'atualizado' && t.perfil && (
            <section className={styles.cartao} aria-labelledby="perfil-do-perito">
              <h2 id="perfil-do-perito" className={styles.cartaoTitulo}>
                Perfil do perito
              </h2>
              <p>
                A IA atualizou o perfil de {t.perfil.perito.nome}: versão {t.perfil.versao}, formada por {t.perfil.versao} laudos. O laudo entrou com a referência do
                caso, sem dado pessoal do cliente; os números são do sistema.
              </p>
              <button type="button" className={proprio.secundario} onClick={() => setVerPerfil(true)}>
                Ver o perfil do perito
              </button>
            </section>
          )}
          {r && pericia.resultado!.noPerfil === 'aguardando-perito' && (
            <section className={styles.cartao} aria-labelledby="quem-foi-o-perito">
              <h2 id="quem-foi-o-perito" className={styles.cartaoTitulo}>
                Quem foi o perito deste laudo?
              </h2>
              <p>O sistema não reconheceu o perito. Um clique liga o laudo ao perfil dele; até lá, o laudo fica fora das contas.</p>
              <div className={styles.atalhos} role="group" aria-label="Ligar o laudo ao perito">
                {peritosParaLigar(pericia.tipo).map((p) => (
                  <button key={p.id} type="button" className={proprio.secundario} onClick={() => void ligar(p.id)}>
                    {p.nome} · {p.especialidade}
                  </button>
                ))}
              </div>
            </section>
          )}

          {r ? null : (
            <>
              <section className={styles.cartao} aria-labelledby="laudo">
                <h2 id="laudo" className={styles.cartaoTitulo}>
                  Laudo da perícia
                </h2>
                <label className={proprio.campo}>
                  Laudo ou registro do GERID (PDF) *
                  {laudo ? (
                    <span className={proprio.arquivo}>
                      ▤ {laudo.nome} · {kb(laudo.tamanho)} · anexado
                    </span>
                  ) : (
                    <input type="file" accept=".pdf" onChange={(e) => void anexar(e.target.files?.[0])} />
                  )}
                </label>
              </section>

              {lido && (
                <section className={proprio.ia} aria-labelledby="resumo-laudo">
                  <h2 id="resumo-laudo" className={proprio.iaTitulo}>
                    Resumo do laudo pela IA
                  </h2>
                  <p>{lido.resumo}</p>
                  <dl className={proprio.prazos}>
                    <dt>Conclusão</dt>
                    <dd>{lido.conclusao}</dd>
                    <dt>Coerência com o pedido</dt>
                    <dd>{lido.coerencia}</dd>
                    <dt>Jurimetria do perito</dt>
                    <dd>
                      {!t.perfil
                        ? 'perito não identificado: sem jurimetria'
                        : j!.suficiente
                          ? `${j!.taxa}% favorável em ${j!.laudos} laudos · amostra suficiente (G22)`
                          : `${j!.laudos} laudos · amostra insuficiente (G22)`}
                    </dd>
                    <dt>Ponto de atenção</dt>
                    <dd>{lido.pontoDeAtencao}</dd>
                    {!lido.favoravel && (
                      <>
                        <dt>Por que foi desfavorável</dt>
                        <dd>{lido.porque}</dd>
                        <dt>Vale pedir nova perícia?</dt>
                        <dd>Indicação da IA: {lido.valeNovaPericia ? 'sim' : 'não'}. Fica no histórico; quem decide é você.</dd>
                      </>
                    )}
                  </dl>
                </section>
              )}

              <section className={styles.cartao} aria-labelledby="favoravel">
                <h2 id="favoravel" className={styles.cartaoTitulo}>
                  O resultado da perícia foi favorável?
                </h2>
                <div className={styles.opcoes} role="radiogroup" aria-label="O resultado da perícia foi favorável?">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      role="radio"
                      aria-checked={favoravel === v}
                      className={styles.opcao}
                      onClick={() => {
                        setFavoravel(v)
                        if (v) setNovaPericia(undefined)
                      }}
                    >
                      {v ? 'Favorável — seguir' : 'Desfavorável — avaliar nova perícia'}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.cartao} aria-labelledby="conferencia">
                <h2 id="conferencia" className={styles.cartaoTitulo}>
                  Conferência (você decide; a IA só resume)
                </h2>
                {exigidas.map((c) => (
                  <label key={c.id} className={proprio.marcar}>
                    <input
                      type="checkbox"
                      checked={conferidas.includes(c.id)}
                      onChange={(e) => setConferidas(e.target.checked ? [...conferidas, c.id] : conferidas.filter((x) => x !== c.id))}
                    />
                    {c.rotulo}
                  </label>
                ))}
              </section>

              <p className={styles.aviso}>Jurimetria com amostra baixa aparece como insuficiente e não chega ao cliente (G22).</p>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={motivo !== null} onClick={() => void registrar()}>
                  Registrar resultado
                </button>
                {judicial && (
                  <>
                    <button type="button" className={proprio.secundario} aria-disabled="true" title="Peça preparada pela IA, que você assina (G6): outra história">
                      Pedir esclarecimentos (quesitos)
                    </button>
                    <button type="button" className={proprio.secundario} aria-disabled="true" title="Peça preparada pela IA, que você assina (G6): outra história">
                      Impugnar o laudo
                    </button>
                  </>
                )}
                {motivo && <p className={styles.motivo}>{motivo}</p>}
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo DP.08.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <span>Se desfavorável: vale pedir nova perícia?</span>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-label="Se desfavorável: vale pedir nova perícia?">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={novaPericia === v}
                  className={styles.chip}
                  disabled={favoravel !== false || !!r}
                  onClick={() => setNovaPericia(v)}
                >
                  {v ? 'Sim, pedir nova perícia' : 'Não, devolver com resultado desfavorável'}
                </button>
              ))}
            </div>
          </div>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <ul className={styles.ladoLista}>
            {exigidas.map((c) => (
              <li key={c.id}>Conferir: {c.rotulo}</li>
            ))}
          </ul>
          <p className={styles.ladoSub}>«Registrar resultado» só habilita com as decisões respondidas e as conferências marcadas.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p className={styles.ladoSub}>
            {judicial
              ? `Prazo para manifestar: ${DIAS_PARA_MANIFESTAR} dias, contado pelo lado seguro (G12)${manifestar ? `, até ${dataCurta(manifestar, hoje)} se registrar hoje` : ''}. Se impugnar ou pedir quesitos, a IA prepara a peça e você assina (G6). `
              : ''}
            O resultado sobe no card e volta para quem pediu ({ORIGENS[pericia.origem].rotulo}): {COMO_SEGUE[pericia.origem]}. Desfavorável: avaliar se vale pedir nova
            perícia (DP.10).
          </p>
        </aside>
      </main>
      <AbaSuporte />
      {verPerfil && t.perfil && <JurimetriaPerito perfil={t.perfil} aoFechar={() => setVerPerfil(false)} />}
    </>
  )
}
