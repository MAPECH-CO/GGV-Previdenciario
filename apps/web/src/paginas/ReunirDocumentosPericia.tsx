import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { ConferirEnviar } from '../componentes/ConferirEnviar.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { CONFERENCIAS_DA_PERICIA, anexarDocumentoDaPericia, concluirDocumentos, justificarFalta, obterPericia, type PericiaNaTela } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora, doServidor } from '../dados/servidor.ts'
import { problemaDoArquivo } from '../regras/arquivos.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { DIAS_ANTES_DOCUMENTOS, MINIMO_DA_FALTA, NOMES_DO_TIPO, motivoParaNaoConcluirDocumentos } from '../regras/pericia.ts'
import styles from './Balcao.module.css'
import cobranca from './Cobranca.module.css'
import proprio from './Pericia.module.css'

// Figma: step_DP.03 (10:522), passo DP.03 do Miro. Tela da Documentação: o que a perícia pede, pelo tipo (laudos e exames na
// médica; CadÚnico, grupo familiar e declarações na social). A cobrança é dela, diária, até 10 dias antes (Lucas, 02/10).

export function ReunirDocumentosPericia({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Documentação')
  const quem = perfil?.usuario ?? 'Documentação'
  const [t, setT] = useState<PericiaNaTela | null | undefined>(undefined)
  const [conferidas, setConferidas] = useState<string[]>([])
  const [faltaDe, setFaltaDe] = useState<string>()
  const [justificativa, setJustificativa] = useState('')
  const [anexar, setAnexar] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterPericia(processoId).then((x) => valendo && setT(x))
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!t?.documentos) {
    return (
      <main className={styles.pagina}>
        <title>Reunir documentos da perícia · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{t === undefined ? 'Abrindo a perícia…' : 'Esta perícia não pede documento novo'}</h1>
        {t !== undefined && <a href={perfil?.inicio ?? '/'}>Voltar ao início</a>}
      </main>
    )
  }

  const { pericia, ficha, documentos } = t
  const hoje = hojeIso(agora())
  const primeiro = ficha.nome.split(' ')[0]
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const exigidas = CONFERENCIAS_DA_PERICIA[pericia.tipo]
  const ate = t.prazos?.documentosAte
  const concluida = pericia.documentos?.concluida
  const motivo = motivoParaNaoConcluirDocumentos({ faltando: documentos.faltando.length, conferidas, exigidas: exigidas.map((c) => c.id) })
  const nomes = documentos.itens.map((i) => i.item.nome.toLowerCase()).join(', ')

  async function agir(acao: () => Promise<PericiaNaTela>, ok: string) {
    if (travado.current) return
    travado.current = true
    setErro('')
    try {
      setT(await acao())
      setAviso(ok)
      setFaltaDe(undefined)
      setJustificativa('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Reunir documentos da perícia · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${t.processo.numero ? `Processo ${t.processo.numero} · ` : ''}${ficha.nome}`} inicio={perfil?.inicio ?? '/'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="DP.03 · Reunir o que a perícia pede (passo do BPMN)">
                DP.03
              </span>
              <span className={styles.codigo}>Documentação</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Reunir documentos da perícia
            </h1>
            <p className={styles.subtitulo}>
              {tipo}
              {ate ? ` · até ${dataCurta(ate, hoje)} (${DIAS_ANTES_DOCUMENTOS} dias antes da perícia)` : ' · a data da perícia ainda não saiu'}
            </p>
          </div>

          <InstrucoesPasso beneficio={t.beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId} funcao="Documentação">
            Reúna o que a {tipo} de {primeiro} pede: {nomes}. Digitalize o que chegar em papel e confira a leitura da IA. Se faltar algo, cobre {primeiro} todo
            dia{ate ? ` até ${dataCurta(ate, hoje)}` : ''}; passou, sobe para a advogada responsável (G15). Não oriente o médico sobre o que escrever (G20).
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          {concluida ? (
            <section className={styles.feito} aria-labelledby="concluida">
              <h2 id="concluida" className={styles.feitoTitulo}>
                ✓ Documentos da perícia reunidos
              </h2>
              <p>
                Concluído por {concluida.quem} em {dataHora(concluida.quando)}. O fluxo voltou ao Jurídico administrativo:{' '}
                {pericia.marcacao ? `ligar e orientar ${primeiro} (DP.06).` : 'subir o comprovante do INSS (DP.02).'}
              </p>
            </section>
          ) : (
            documentos.passouDoLimite && (
              <p className={styles.trava}>
                Passou do limite de {DIAS_ANTES_DOCUMENTOS} dias antes da perícia com documento faltando: a advogada responsável decide (G15). Registre a falta com
                justificativa para concluir.
              </p>
            )
          )}

          <section className={styles.cartao} aria-labelledby="o-que-pede">
            <h2 id="o-que-pede" className={styles.cartaoTitulo}>
              O que a perícia pede
            </h2>
            <ul className={proprio.itens} aria-label="O que a perícia pede">
              {documentos.itens.map(({ item, arquivo, falta }) => (
                <li key={item.id} className={proprio.itemPericia}>
                  <span className={proprio.itemNome}>
                    <span aria-hidden="true">{arquivo ? '✓' : falta ? '—' : '○'}</span> {item.nome}
                  </span>
                  <span className={cobranca.detalhe}>
                    {arquivo ? `anexado: ${arquivo.nome} · ${dataCurta(arquivo.data, hoje)}` : falta ? `falta registrada: ${falta}` : 'falta'}
                  </span>
                  {!arquivo && !falta && !concluida && (
                    <span className={styles.atalhos}>
                      {doServidor(processoId) ? (
                        // No caso do servidor, o documento sobe direto à pasta do caso, com o tipo do item (GGVP-56, CA4).
                        <label className={styles.atalho}>
                          Anexar
                          <input
                            type="file"
                            className="so-leitor"
                            accept=".pdf,.jpg,.jpeg,.png"
                            aria-label={`Anexar: ${item.nome}`}
                            onChange={(e) => {
                              const arquivo = e.target.files?.[0]
                              e.target.value = ''
                              if (!arquivo) return
                              const problema = problemaDoArquivo({ nome: arquivo.name, tamanho: arquivo.size })
                              if (problema) return setErro(problema)
                              void agir(() => anexarDocumentoDaPericia(processoId, item.id, arquivo, arquivo.name), `Anexado: ${item.nome}, na pasta do caso.`)
                            }}
                          />
                        </label>
                      ) : (
                        <button type="button" className={styles.atalho} onClick={() => setAnexar(true)}>
                          Anexar
                        </button>
                      )}
                      <button type="button" className={styles.atalho} aria-expanded={faltaDe === item.id} onClick={() => setFaltaDe(faltaDe === item.id ? undefined : item.id)}>
                        Registrar a falta
                      </button>
                      <a className={styles.atalho} href={`/casos/${processoId}/pericia/cobranca`}>
                        {item.laudo ? 'Cobrar e pedir ao médico' : 'Cobrar'}
                      </a>
                    </span>
                  )}
                  {faltaDe === item.id && (
                    <div className={cobranca.formulario}>
                      <label className={proprio.campo}>
                        Por que falta? *
                        <textarea rows={2} maxLength={300} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                      </label>
                      <button
                        type="button"
                        className={cobranca.botao}
                        disabled={justificativa.trim().length < MINIMO_DA_FALTA}
                        onClick={() => agir(() => justificarFalta(processoId, item.id, justificativa, quem), `Falta registrada: ${item.nome}.`)}
                      >
                        Registrar a falta
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className={cobranca.detalhe}>
              O que chega em papel segue a digitalização e a leitura da IA do D1:{' '}
              <a href={`/clientes/${ficha.id}/conferir-documentos`}>conferir os documentos lidos</a>.
            </p>
          </section>

          {!concluida && (
            <>
              <section className={styles.cartao} aria-labelledby="conferir">
                <h2 id="conferir" className={styles.cartaoTitulo}>
                  Conferir
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

              <div className={styles.rodape}>
                <button
                  type="button"
                  className={styles.principalBotao}
                  disabled={motivo !== null}
                  onClick={() => agir(() => concluirDocumentos(processoId, { conferidas }, quem), 'Documentos concluídos: a perícia voltou ao Jurídico administrativo.')}
                >
                  Concluir
                </button>
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo DP.03.</p>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Concluir» só habilita com as conferências marcadas e o pendente resolvido: anexado, ou a falta registrada com justificativa.</p>
          <p className={styles.ladoSub}>
            Quem cobra é a Documentação, todo dia, até {DIAS_ANTES_DOCUMENTOS} dias antes da perícia; 3 dias antes começa a preparação do cliente. Passou,
            sobe para a advogada responsável (G15, resposta do Lucas de 02/10).
          </p>
          <p className={styles.ladoSub}>Não oriente o médico sobre o que escrever (G20).</p>
        </aside>
      </main>
      <AbaSuporte />
      {anexar && (
        <ConferirEnviar
          fichaId={ficha.id}
          origem="card"
          aoEnviar={async (r) => {
            setAnexar(false)
            setT(await obterPericia(processoId))
            setAviso(`${r.arquivos.length === 1 ? '1 arquivo enviado' : `${r.arquivos.length} arquivos enviados`} para a pasta do cliente: seguem a leitura da IA (D1).`)
          }}
          aoFechar={() => setAnexar(false)}
        />
      )}
    </>
  )
}
