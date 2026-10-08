import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { usePerfil } from '../dados/perfis.ts'
import { editaRoteiro, obterRoteiro, obterRoteiros, salvarRoteiro } from '../dados/roteiro.ts'
import { agora } from '../dados/servidor.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { TEXTO_MAXIMO, TIPOS_DO_ITEM, emVigor, motivoParaNaoSalvar, mudancas, type ItemDoRoteiro, type Roteiro as TipoRoteiro, type TipoDoItem } from '../regras/roteiro.ts'
import styles from './Balcao.module.css'
import proprio from './Roteiro.module.css'

// Sem quadro próprio no Figma: o roteiro aparece aplicado no Parecer médico (1654:2) e no step_D1.21M (14:195). Visual das
// telas de passo (GGVP-93). Editar: sênior. Ver: Jurídico. Atendimento e Documentação veem só o que falta pedir, no parecer.

const JURIDICO = ['advogada', 'senior', 'senior-2']

const TITULOS: Record<TipoDoItem, string> = {
  obrigatorio: 'Obrigatórios · o que o documento precisa abordar',
  contradicao: 'Contradições que bloqueiam (G18)',
  complementar: 'Documentos complementares',
}

const quando = (iso: string, hoje: string) => dataCurta(hojeIso(new Date(iso)), hoje)

/** /roteiros e /roteiros/:id */
export function Roteiro({ id }: { id?: string }) {
  const perfil = usePerfil('Advogada')
  const doJuridico = JURIDICO.includes(perfil?.id ?? '')
  return (
    <>
      <title>{id ? 'Roteiro do benefício · GGV Previdenciário' : 'Roteiros de laudos · GGV Previdenciário'}</title>
      <TopoPasso contexto="Roteiro de laudos" inicio={perfil?.inicio ?? '/advogada'} />
      {!doJuridico ? (
        <main className={proprio.vazia}>
          <h1 className={styles.titulo}>O roteiro de laudos é do Jurídico</h1>
          <p className={styles.motivo}>
            Você está como {perfil?.rotulo ?? 'outro perfil'}. O que falta pedir ao cliente aparece no parecer médico do caso, em linguagem simples.
          </p>
          <a href={perfil?.inicio ?? '/'}>Voltar ao início</a>
        </main>
      ) : id ? (
        <Detalhe id={id} edita={editaRoteiro(perfil?.id)} perfil={perfil?.id} nome={perfil?.usuario ?? 'Sênior'} />
      ) : (
        <Lista />
      )}
      <AbaSuporte />
    </>
  )
}

function Lista() {
  const [roteiros, setRoteiros] = useState<TipoRoteiro[] | undefined>(undefined)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterRoteiros().then((r) => valendo && setRoteiros(r))
    return () => {
      valendo = false
    }
  }, [])

  return (
    <main className={styles.pagina}>
      <div className={styles.principal}>
        <div className={styles.cabecalho}>
          <div className={styles.chips}>
            <span className={styles.codigo} title="D1.21M · Analisar a documentação médica (passo do BPMN)">
              D1.21M
            </span>
            <span className={proprio.juridico}>Jurídico</span>
          </div>
          <h1 className={styles.titulo}>Roteiros de laudos</h1>
          <p className={styles.subtitulo}>A régua de cada benefício: o que a IA procura nos documentos e a advogada confere.</p>
        </div>
        {!roteiros ? (
          <p className={styles.motivo}>Abrindo os roteiros…</p>
        ) : (
          <ul className={proprio.lista} aria-label="Roteiros">
            {roteiros.map((r) => {
              const v = emVigor(r)
              return (
                <li key={r.id}>
                  <a className={proprio.roteiro} href={`/roteiros/${r.id}`}>
                    <span className={proprio.roteiroTopo}>
                      <span className={proprio.roteiroNome}>{r.nome}</span>
                      {!r.laudo && <span className={proprio.semLaudo}>sem laudo · régua documental</span>}
                    </span>
                    <span className={proprio.detalhe}>{r.beneficios.map(nomeBeneficio).join(' · ')}</span>
                    <span className={proprio.detalhe}>
                      versão {v.versao} · {v.autor}, {quando(v.quando, hoje)} · {v.itens.filter((i) => i.tipo === 'obrigatorio').length} itens obrigatórios
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Lado />
    </main>
  )
}

function Detalhe({ id, edita, perfil, nome }: { id: string; edita: boolean; perfil?: string; nome: string }) {
  const [roteiro, setRoteiro] = useState<TipoRoteiro | null | undefined>(undefined)
  const [rascunho, setRascunho] = useState<ItemDoRoteiro[] | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [feito, setFeito] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const novos = useRef(0)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterRoteiro(id).then((r) => valendo && setRoteiro(r))
    return () => {
      valendo = false
    }
  }, [id])

  if (!roteiro) {
    return (
      <main className={proprio.vazia}>
        <h1 className={styles.titulo}>{roteiro === null ? 'Roteiro não encontrado' : 'Abrindo o roteiro…'}</h1>
        {roteiro === null && <a href="/roteiros">Ver os roteiros</a>}
      </main>
    )
  }

  const vigor = emVigor(roteiro)
  const itens = rascunho ?? vigor.itens
  const motivo = rascunho ? motivoParaNaoSalvar(rascunho) : null
  const mudar = (i: number, parte: Partial<ItemDoRoteiro>) => setRascunho(itens.map((item, j) => (j === i ? { ...item, ...parte } : item)))

  async function salvar() {
    if (!rascunho || motivo || travado.current) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const salvo = await salvarRoteiro(roteiro!.id, rascunho, { perfil, nome })
      setRoteiro(salvo)
      setRascunho(null)
      setFeito(`Versão ${emVigor(salvo).versao} salva por ${nome} em ${dataHora(emVigor(salvo).quando)}. Os casos já analisados continuam com a versão que usaram.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para salvar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  return (
    <main className={styles.pagina}>
      <div className={styles.principal}>
        <div className={styles.cabecalho}>
          <div className={styles.chips}>
            <span className={styles.codigo} title="D1.21M · Analisar a documentação médica (passo do BPMN)">
              D1.21M
            </span>
            <span className={proprio.juridico}>Jurídico</span>
            {!roteiro.laudo && <span className={proprio.semLaudo}>sem laudo · régua documental</span>}
          </div>
          <h1 className={styles.titulo}>
            <strong>{roteiro.nome}</strong> · Roteiro de conteúdo mínimo
          </h1>
          <p className={styles.subtitulo}>
            {roteiro.beneficios.map(nomeBeneficio).join(' · ')} · versão {vigor.versao}, por {vigor.autor} em {quando(vigor.quando, hoje)}
          </p>
        </div>

        <p className={styles.aviso}>
          O texto de cada item serve para reconhecer no documento se o requisito foi atendido, nunca para ditar ao médico o que escrever (G20). A orientação ao
          médico usa a pergunta do item.
        </p>

        {feito && (
          <section className={styles.feito} aria-labelledby="salvo">
            <h2 id="salvo" className={styles.feitoTitulo}>
              ✓ Nova versão salva
            </h2>
            <p>{feito}</p>
          </section>
        )}

        {(Object.keys(TITULOS) as TipoDoItem[]).map((tipo) => {
          const doTipo = itens.map((item, i) => ({ item, i })).filter((x) => x.item.tipo === tipo)
          return (
            <section key={tipo} className={styles.cartao} aria-labelledby={`tipo-${tipo}`}>
              <h2 id={`tipo-${tipo}`} className={styles.cartaoTitulo}>
                {TITULOS[tipo]}
              </h2>
              {doTipo.length === 0 && <p className={proprio.detalhe}>Nenhum item.</p>}
              <ol className={proprio.itens} aria-label={TITULOS[tipo]}>
                {doTipo.map(({ item, i }) =>
                  rascunho ? (
                    <li key={item.id} className={proprio.edicao}>
                      <label className={proprio.campo}>
                        Tipo do item
                        <select value={item.tipo} onChange={(e) => mudar(i, { tipo: e.target.value as TipoDoItem })}>
                          {(Object.keys(TIPOS_DO_ITEM) as TipoDoItem[]).map((t) => (
                            <option key={t} value={t}>
                              {TIPOS_DO_ITEM[t]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={proprio.campo}>
                        Texto do item
                        <textarea rows={2} maxLength={TEXTO_MAXIMO} value={item.texto} onChange={(e) => mudar(i, { texto: e.target.value })} />
                      </label>
                      {tipo === 'obrigatorio' && (
                        <label className={proprio.campo}>
                          Pergunta ao médico
                          <textarea rows={2} maxLength={TEXTO_MAXIMO} value={item.pergunta ?? ''} onChange={(e) => mudar(i, { pergunta: e.target.value })} />
                        </label>
                      )}
                      <button type="button" className={proprio.tirar} onClick={() => setRascunho(itens.filter((_, j) => j !== i))}>
                        Tirar este item
                      </button>
                    </li>
                  ) : (
                    <li key={item.id} className={proprio.item}>
                      <span className={proprio.itemTexto}>{item.texto}</span>
                      {item.pergunta && <span className={proprio.detalhe}>Pergunta ao médico: {item.pergunta}</span>}
                    </li>
                  ),
                )}
              </ol>
              {rascunho && (
                <button
                  type="button"
                  className={styles.atalho}
                  onClick={() => setRascunho([...itens, { id: `novo-${vigor.versao + 1}-${(novos.current += 1)}`, tipo, texto: '' }])}
                >
                  + Item {TIPOS_DO_ITEM[tipo].toLowerCase()}
                </button>
              )}
            </section>
          )
        })}

        <section className={styles.cartao} aria-labelledby="versoes">
          <h2 id="versoes" className={styles.cartaoTitulo}>
            Versões
          </h2>
          <ol className={proprio.itens} aria-label="Versões">
            {[...roteiro.versoes].reverse().map((v) => {
              const anterior = roteiro.versoes.find((x) => x.versao === v.versao - 1)
              return (
                <li key={v.versao} className={proprio.item}>
                  <span className={proprio.itemTexto}>
                    Versão {v.versao}
                    {v.versao === vigor.versao ? ' · em vigor' : ''}
                  </span>
                  <span className={proprio.detalhe}>
                    {v.autor} · {dataHora(v.quando)} · {anterior ? mudancas(anterior, v) : 'primeira versão'}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>

        <div className={styles.rodape}>
          {!edita ? (
            <p className={styles.motivo}>Só a sênior edita o roteiro. Você vê a versão em vigor e as anteriores.</p>
          ) : rascunho ? (
            <>
              <button type="button" className={styles.principalBotao} disabled={motivo !== null || salvando} onClick={salvar}>
                {salvando ? 'salvando…' : `Salvar como versão ${vigor.versao + 1}`}
              </button>
              <button type="button" className={proprio.secundario} onClick={() => setRascunho(null)}>
                Cancelar
              </button>
              {motivo && <p className={styles.motivo}>{motivo}</p>}
            </>
          ) : (
            <button
              type="button"
              className={styles.principalBotao}
              onClick={() => {
                setFeito('')
                setRascunho(vigor.itens)
              }}
            >
              Editar o roteiro
            </button>
          )}
        </div>
        {erro && (
          <p role="alert" className={styles.motivo}>
            {erro}
          </p>
        )}
      </div>
      <Lado />
    </main>
  )
}

function Lado() {
  return (
    <aside className={styles.lado} aria-labelledby="antes-de-concluir">
      <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
        Antes de concluir
      </h2>
      <p className={styles.ladoSub}>O roteiro é a régua do passo D1.21M: a IA aplica no laudo, e uma pessoa do Jurídico confere (G17).</p>
      <h3 className={styles.ladoSecao}>Quem mexe</h3>
      <p className={styles.ladoSub}>A sênior edita; o Jurídico vê. Atendimento e Documentação veem só o que falta pedir, no parecer.</p>
      <h3 className={styles.ladoSecao}>Travas</h3>
      <p className={styles.ladoSub}>«Salvar» só habilita com pelo menos um item obrigatório e o texto de cada item.</p>
      <h3 className={styles.ladoSecao}>Como segue</h3>
      <p>Salvar cria a versão seguinte, com autor e data. Cada caso guarda a versão usada na análise dele.</p>
    </aside>
  )
}
