import { useEffect, useRef, useState } from 'react'
import { nomeTipo } from '../dados/catalogos.ts'
import { doJuridico, obterParecer, type ParecerNaTela, type SituacaoNaTela } from '../dados/parecer.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import { NOMES_DO_PARECER, SITUACOES_DO_ITEM } from '../regras/parecer.ts'
import styles from '../paginas/Parecer.module.css'
import passo from '../paginas/Balcao.module.css'

// Figma: "Overlay · Parecer médico" (1654:2), sobre as telas de passo (GGVP-20). O que o Atendimento vê: o resultado, os
// documentos e o que falta pedir; o conteúdo clínico fica com o Jurídico.

const ROTULOS: Record<SituacaoNaTela, string> = { ...NOMES_DO_PARECER, 'sem-documentos': 'Sem documentos', dispensado: 'Dispensado' }

function frase(p: ParecerNaTela): string {
  switch (p.situacao) {
    case 'suficiente':
      return `A documentação médica cobre o que o ${p.beneficio} exige.`
    case 'insuficiente':
      return `A documentação médica ainda não cobre o que o ${p.beneficio} exige.`
    case 'contraditorio':
      return `Um documento contradiz o requisito do ${p.beneficio}: o caso não avança (G18).`
    case 'pendente':
      return 'A IA analisou os documentos; falta a conferência do Jurídico (G17).'
    case 'dispensado':
      return 'Duas sêniores dispensaram o parecer, com justificativa: o caso segue assumindo o risco (G17).'
    default:
      return 'Nenhum documento médico chegou para este caso.'
  }
}

const mesAno = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`

type Props = { processoId: string; /** A função da tela que abriu: vale até a pessoa escolher outro perfil. */ funcao: string; aoFechar: () => void }

export function ParecerMedico({ processoId, funcao, aoFechar }: Props) {
  const perfil = usePerfil(funcao)
  const juridico = doJuridico(perfil?.id)
  const senior = perfil?.id.startsWith('senior') === true
  const janela = useRef<HTMLDialogElement>(null)
  const [p, setP] = useState<ParecerNaTela | null | undefined>(undefined)
  const [historico, setHistorico] = useState(false)
  const hoje = hojeIso(agora())
  const curta = (iso: string) => dataCurta(hojeIso(new Date(iso)), hoje)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  useEffect(() => {
    let valendo = true
    obterParecer(processoId, juridico ? 'juridico' : 'atendimento').then((x) => valendo && setP(x))
    return () => {
      valendo = false
    }
  }, [processoId, juridico])

  const itens = p?.juridico?.registro?.itens ?? p?.juridico?.analise?.itens ?? []
  const analise = p?.juridico?.analise

  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="parecer-titulo" onClose={aoFechar}>
      <div className={styles.janelaCorpo}>
        <div className={styles.janelaTopo}>
          <div>
            <h2 id="parecer-titulo" className={styles.janelaTitulo}>
              Parecer médico de suficiência
            </h2>
            {p && (
              <p className={styles.selos}>
                <span className={passo.codigo}>D1.21M</span>
                <span className={passo.codigo}>G17</span>
                <span className={passo.beneficio}>◆ {p.beneficio}</span>
                <span className={styles.detalhe}>
                  {p.ficha.nome}
                  {p.processo.numero ? ` · processo ${p.processo.numero}` : ''}
                </span>
              </p>
            )}
          </div>
          <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
            ×
          </button>
        </div>

        {!p ? (
          <p className={styles.detalhe}>{p === null ? 'Caso não encontrado.' : 'Abrindo o parecer…'}</p>
        ) : (
          <>
            <div className={styles.resultado} data-situacao={p.situacao} role="status">
              <span className={styles[p.situacao === 'sem-documentos' ? 'pendente' : p.situacao === 'dispensado' ? 'suficiente' : p.situacao]}>{ROTULOS[p.situacao].toUpperCase()}</span>
              <div>
                <p className={styles.resultadoTitulo}>{frase(p)}</p>
                <p className={styles.detalhe}>
                  {p.sugeridoEm && `Sugerido pela IA em ${curta(p.sugeridoEm)} · `}
                  {p.confirmado ? `confirmado por pessoa: ${p.confirmado.quem}, ${curta(p.confirmado.quando)} (G17).` : p.situacao !== 'sem-documentos' ? 'aguardando a conferência do Jurídico (G17).' : ''}{' '}
                  Só a sênior dispensa o parecer, com justificativa.
                </p>
                {!p.precisaParecer && <p className={styles.detalhe}>{p.beneficio} não está na matriz de laudos: o parecer não trava a liberação.</p>}
                {p.laudoNovoEm && <p className={styles.detalhe}>Laudo novo de {dataCurta(p.laudoNovoEm, hoje)} esperando a conferência do Jurídico.</p>}
              </div>
            </div>

            {p.dispensa && (
              <section aria-labelledby="dispensa">
                <h3 id="dispensa" className={styles.secao}>
                  Dispensa do parecer (G17)
                </h3>
                <p className={styles.detalhe}>
                  Pedida por {p.dispensa.pedidaPor} em {curta(p.dispensa.pedidaEm)}
                  {p.dispensa.aprovadaPor && p.dispensa.aprovadaEm
                    ? ` · aprovada por ${p.dispensa.aprovadaPor} em ${curta(p.dispensa.aprovadaEm)}`
                    : p.dispensa.recusadaPor
                      ? ` · recusada por ${p.dispensa.recusadaPor}`
                      : ' · esperando a segunda sênior'}
                  . Justificativa: {p.dispensa.justificativa}
                </p>
              </section>
            )}

            <section aria-labelledby="analisados">
              <h3 id="analisados" className={styles.secao}>
                Documentos analisados
              </h3>
              {p.documentos.length === 0 ? (
                <p className={styles.detalhe}>Nenhum ainda.</p>
              ) : (
                <ul className={styles.lista} aria-label="Documentos analisados">
                  {p.documentos.map((d) => {
                    const resumo = analise?.documentos.find((x) => x.id === d.id)?.resumo
                    return (
                      <li key={d.id} className={styles.documento}>
                        <span className={styles.pdf} aria-hidden="true">
                          PDF
                        </span>
                        <span>
                          {nomeTipo(d.tipo)} · {mesAno(d.data)}
                          <span className={styles.detalhe}>
                            <br />
                            {[d.emitente, resumo].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {juridico ? (
              <section aria-labelledby="roteiro-aplicado">
                <h3 id="roteiro-aplicado" className={styles.secao}>
                  Roteiro do benefício · o que o documento precisa abordar (roteiro de laudos)
                  {p.roteiro ? ` · versão ${p.roteiro.versao}` : ''}
                </h3>
                {p.semRoteiro ? (
                  <p className={styles.detalhe}>Benefício sem roteiro: a conferência é manual.</p>
                ) : (
                  <ul className={styles.lista} aria-label="Roteiro aplicado">
                    {itens.map((i) => {
                      const evidencia = analise?.itens.find((x) => x.id === i.id)?.evidencia
                      return (
                        <li key={i.id} className={styles.check}>
                          <span className={styles.marca} data-situacao={i.situacao} aria-hidden="true">
                            {i.situacao === 'presente' ? '✓' : i.situacao === 'contraditorio' ? '!' : i.tipo === 'contradicao' ? '✓' : '–'}
                          </span>
                          <span>
                            {i.tipo === 'contradicao' ? `Sem contradição: ${i.texto}` : i.texto}
                            <span className={styles.detalhe}>
                              <br />
                              {i.tipo === 'contradicao'
                                ? i.situacao === 'contraditorio'
                                  ? `encontrada${evidencia ? ` em ${evidencia.documento}` : ''}: o caso trava (G18)`
                                  : 'não encontrada'
                                : `${SITUACOES_DO_ITEM[i.situacao]}${evidencia ? ` · ${evidencia.documento}` : ''}`}
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            ) : (
              <section aria-labelledby="falta-pedir">
                <h3 id="falta-pedir" className={styles.secao}>
                  O que falta pedir
                </h3>
                {p.faltaPedir.length === 0 ? (
                  <p className={styles.detalhe}>{p.situacao === 'suficiente' ? 'Nada: a documentação cobre o que o benefício exige.' : 'Nada por enquanto: o Jurídico ainda confere.'}</p>
                ) : (
                  <ul className={styles.lista} aria-label="O que falta pedir">
                    {p.faltaPedir.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <p className={styles.nota}>
              O que o Atendimento vê aqui: o resultado, os documentos e o que falta pedir. O conteúdo clínico (CID, texto dos laudos) fica com o Jurídico. Se
              algo faltar, o pedido ao médico lista o que o documento deve abordar, sem sugerir diagnóstico, CID ou conclusão (G20).
            </p>

            {historico && (
              <ul className={styles.lista} aria-label="Histórico do parecer">
                {p.historico.length === 0 && <li className={styles.detalhe}>Nenhum parecer registrado ainda.</li>}
                {[...p.historico].reverse().map((h) => (
                  <li key={h.quando}>
                    {ROTULOS[h.situacao]} · {h.quem} · {dataHora(h.quando)}
                    {h.roteiro ? ` · roteiro versão ${h.roteiro.versao}` : ''}
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.botoes}>
              {p.faltaPedir.length > 0 ? (
                <a className={passo.atalho} href={`/casos/${p.processo.id}/complemento`}>
                  Pedir complemento ao médico
                </a>
              ) : (
                <button type="button" className={passo.atalho} disabled>
                  Pedir complemento ao médico
                </button>
              )}
              <button type="button" className={passo.atalho} aria-pressed={historico} onClick={() => setHistorico((h) => !h)}>
                Histórico do parecer
              </button>
              {juridico && (
                <a className={passo.atalho} href={`/casos/${p.processo.id}/parecer`}>
                  Abrir o parecer
                </a>
              )}
              {senior && p.precisaParecer && p.situacao !== 'suficiente' && (
                <a className={passo.atalho} href={`/casos/${p.processo.id}/parecer/dispensa`}>
                  Dispensar o parecer
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
