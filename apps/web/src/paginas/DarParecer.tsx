import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { ParecerMedico } from '../componentes/ParecerMedico.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { nomeTipo } from '../dados/catalogos.ts'
import { doJuridico, obterParecer, registrarParecer, type ParecerNaTela } from '../dados/parecer.ts'
import { usePerfil } from '../dados/perfis.ts'
import { enquadramentoDoCaso } from '../dados/deficiencia.ts'
import { CartaoDaCrianca } from './CartaoDaCrianca.tsx'
import { agora } from '../dados/servidor.ts'
import { isoParaData } from '../campos.ts'
import { dataCurta, dataHora, hojeIso } from '../regras/datas.ts'
import {
  NOMES_DO_PARECER,
  SITUACOES_DO_ITEM,
  TEXTO_MAXIMO_DO_PARECER,
  motivoParaNaoRegistrar,
  problemaG20,
  situacaoFinal,
  type Conferidos,
  type ItemAnalisado,
  type SituacaoDoItem,
} from '../regras/parecer.ts'
import styles from './Balcao.module.css'
import passo from './Passo.module.css'
import proprio from './Parecer.module.css'

// Figma: step_D1.21M "Dar parecer médico" (14:195), com a matriz do roteiro item a item que o cartão pede (GGVP-20, CA1 a
// CA8). A IA sugere; a advogada confere cada item e registra (G17).

type Decisao = 'suficiente' | 'insuficiente'

const DECISOES: { id: Decisao; texto: string }[] = [
  { id: 'suficiente', texto: 'Suficiente — liberar' },
  { id: 'insuficiente', texto: 'Insuficiente — pedir complemento' },
]

const OPCOES: SituacaoDoItem[] = ['presente', 'ausente', 'contraditorio']

/** "confere" é a situação que a IA achou; as outras corrigem. */
const valorDaConferencia = (i: ItemAnalisado, escolhido?: SituacaoDoItem) => (!escolhido ? '' : escolhido === i.situacao ? 'confere' : escolhido)

export function DarParecer({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Advogada')
  const juridico = doJuridico(perfil?.id)
  const [p, setP] = useState<ParecerNaTela | null | undefined>(undefined)
  const [conferidos, setConferidos] = useState<Conferidos>({})
  const [decisao, setDecisao] = useState<Decisao>()
  const [abordar, setAbordar] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [feito, setFeito] = useState(false)
  const [resultado, setResultado] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterParecer(processoId, juridico ? 'juridico' : 'atendimento').then((x) => valendo && setP(x))
    return () => {
      valendo = false
    }
  }, [processoId, juridico])

  if (!p) {
    return (
      <main className={proprio.vazia}>
        <title>Dar parecer médico · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{p === null ? 'Caso não encontrado' : 'Abrindo o parecer…'}</h1>
        {p === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, beneficio } = p
  const analise = p.juridico?.analise
  const itens = analise?.itens ?? []
  const obrigatorios = itens.filter((i) => i.tipo === 'obrigatorio')
  const contradicoes = itens.filter((i) => i.tipo === 'contradicao')
  const textoAbordar = abordar ?? p.juridico?.abordarSugerido ?? ''
  const motivo = motivoParaNaoRegistrar({ itens, conferidos, decisao, abordar: textoAbordar, semRoteiro: p.semRoteiro, conferenciaManual: manual })
  const comContradicao = itens.some((i) => conferidos[i.id] === 'contraditorio')
  const final = decisao ? situacaoFinal(itens, conferidos, decisao) : undefined
  const g20 = decisao === 'insuficiente' || comContradicao ? problemaG20(textoAbordar) : null
  const curta = (iso: string) => dataCurta(hojeIso(new Date(iso)), hoje)
  const comparacao = p.juridico?.comparacao

  async function registrar() {
    if (travado.current || motivo || !decisao || !analise) return
    travado.current = true
    setRegistrando(true)
    setErro('')
    try {
      const depois = await registrarParecer(
        processoId,
        { analise: analise.quando, conferidos, decisao, abordar: textoAbordar, ...(p!.semRoteiro && { conferenciaManual: manual }) },
        { perfil: perfil?.id, nome: perfil?.usuario ?? 'Advogada' },
      )
      setP(depois)
      setFeito(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar o parecer.')
    } finally {
      travado.current = false
      setRegistrando(false)
    }
  }

  const linhaDoItem = (i: ItemAnalisado) => (
    <li key={i.id} className={proprio.item}>
      <span className={proprio.itemTexto}>
        <span>{i.texto}</span>
        {i.evidencia ? (
          <span className={proprio.evidencia}>
            {i.evidencia.documento} · pág. {i.evidencia.pagina} — <span className={proprio.trecho}>“{i.evidencia.trecho}”</span>
          </span>
        ) : (
          <span className={proprio.evidencia}>{i.tipo === 'contradicao' ? 'A IA não encontrou nos documentos.' : 'A IA não achou nos documentos.'}</span>
        )}
      </span>
      <span className={proprio[i.situacao]}>{i.tipo === 'contradicao' ? (i.situacao === 'contraditorio' ? 'encontrada' : 'não encontrada') : SITUACOES_DO_ITEM[i.situacao]}</span>
      <label className={proprio.conferir}>
        Sua conferência
        <select
          aria-label={`Conferência: ${i.texto}`}
          value={valorDaConferencia(i, conferidos[i.id])}
          onChange={(e) => setConferidos((c) => ({ ...c, [i.id]: e.target.value === 'confere' ? i.situacao : (e.target.value as SituacaoDoItem) || undefined }))}
        >
          <option value="">Escolha…</option>
          <option value="confere">Confere com a IA</option>
          {OPCOES.filter((o) => o !== i.situacao && (i.tipo === 'obrigatorio' || o !== 'presente')).map((o) => (
            <option key={o} value={o}>
              Corrigir: {i.tipo === 'contradicao' ? (o === 'contraditorio' ? 'encontrada' : 'não encontrada') : SITUACOES_DO_ITEM[o]}
            </option>
          ))}
        </select>
      </label>
    </li>
  )

  return (
    <>
      <title>{`${ficha.nome} · Dar parecer médico · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${processo.numero ? `Processo ${processo.numero} · ` : ''}${ficha.nome.split(' ')[0]}`} inicio={perfil?.inicio ?? '/advogada'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.21M · Analisar a documentação médica (passo do BPMN)">
                D1.21M
              </span>
              <span className={proprio.advogada}>Advogada</span>
              <span className={styles.beneficio}>◆ {beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Dar parecer médico
            </h1>
            <p className={styles.subtitulo}>{beneficio} · suficiência da documentação médica</p>
          </div>

          {!juridico ? (
            <>
              <p className={styles.aviso} role="status">
                O parecer médico é do Jurídico: dado de saúde só aparece para a advogada. Você está como {perfil?.rotulo ?? 'outro perfil'} e vê só o resultado.
              </p>
              <button type="button" className={styles.atalho} onClick={() => setResultado(true)}>
                Ver o resultado do parecer
              </button>
            </>
          ) : !analise ? (
            <section className={styles.cartao} aria-labelledby="sem-documento">
              <h2 id="sem-documento" className={styles.cartaoTitulo}>
                Nenhum documento médico para analisar
              </h2>
              <p className={proprio.detalhe}>Quando um laudo, relatório ou prontuário chegar e for lido, a IA monta a análise aqui.</p>
            </section>
          ) : (
            <>
              {p.laudoNovoEm && (
                <section className={styles.instrucoes} aria-labelledby="laudo-novo">
                  <div className={styles.instrucoesTopo}>
                    <span className={styles.estrela} aria-hidden="true">
                      ✦
                    </span>
                    <h2 id="laudo-novo" className={styles.instrucoesTitulo}>
                      Laudo novo · enviado pelo Atendimento em {dataCurta(p.laudoNovoEm, hoje)}
                    </h2>
                  </div>
                  <p className={styles.instrucoesTexto}>
                    A IA leu o laudo novo e comparou com o que está no processo: {comparacao?.resumo[0] ?? 'veja a comparação.'} Abra a análise e confirme se é melhor;
                    o parecer de suficiência (G17) pode precisar ser refeito.
                  </p>
                  <div className={styles.atalhos}>
                    <a className={styles.atalho} href={`/casos/${processo.id}/laudo-novo`}>
                      Abrir o laudo novo
                    </a>
                    <a className={styles.atalho} href={`/casos/${processo.id}/laudo-novo#comparacao`}>
                      Comparar com o anterior
                    </a>
                  </div>
                  <p className={styles.nota}>Resumo e comparação montados pela IA. Confira antes de agir.</p>
                </section>
              )}

              {feito && p.juridico?.registro && (
                <section className={styles.feito} aria-labelledby="registrado">
                  <h2 id="registrado" className={styles.feitoTitulo}>
                    ✓ Parecer registrado: {NOMES_DO_PARECER[p.juridico.registro.situacao]}
                  </h2>
                  <p>
                    {p.juridico.registro.quem} em {dataHora(p.juridico.registro.quando)}
                    {p.juridico.registro.roteiro ? ` · roteiro ${p.juridico.registro.roteiro.nome}, versão ${p.juridico.registro.roteiro.versao}` : ' · conferência manual'}.
                    {p.juridico.registro.situacao !== 'suficiente' && ' A pendência «Pedir complemento ao médico» foi para o Atendimento, com o que o documento deve abordar.'}
                    {p.juridico.registro.laudoNovo && ` O laudo novo de ${dataCurta(p.juridico.registro.laudoNovo, hoje)} foi conferido e saiu da ficha e do processo.`}
                  </p>
                  <div className={styles.atalhos}>
                    <button type="button" className={styles.atalho} onClick={() => setResultado(true)}>
                      Ver o resultado do parecer
                    </button>
                    <a className={styles.atalho} href="/advogada">
                      Voltar ao início
                    </a>
                  </div>
                </section>
              )}

              {p.semRoteiro && (
                <section className={styles.cartao} aria-labelledby="sem-roteiro">
                  <h2 id="sem-roteiro" className={styles.cartaoTitulo}>
                    Benefício sem roteiro
                  </h2>
                  <p className={styles.aviso}>
                    {beneficio} não tem roteiro de laudos cadastrado. A IA não tem régua para conferir: a conferência é manual (GGVP-93).
                  </p>
                  <label className={proprio.campo}>
                    O que você conferiu nos documentos *
                    <textarea rows={3} maxLength={TEXTO_MAXIMO_DO_PARECER} value={manual} onChange={(e) => setManual(e.target.value)} />
                  </label>
                </section>
              )}

              {analise.mudou.length > 0 && (
                <section className={styles.cartao} aria-labelledby="mudou">
                  <h2 id="mudou" className={styles.cartaoTitulo}>
                    O que mudou desde a análise anterior
                  </h2>
                  <ul className={proprio.lista} aria-label="O que mudou">
                    {analise.mudou.map((m) => (
                      <li key={m}>• {m}</li>
                    ))}
                  </ul>
                </section>
              )}

              {processo.beneficio.startsWith('aposentadoria-pcd') && (
                <section className={styles.cartao} aria-labelledby="pcd">
                  <h2 id="pcd" className={styles.cartaoTitulo}>
                    Enquadramento dos períodos PCD
                  </h2>
                  <p>{enquadramentoDoCaso(processo.id) ?? 'Sem os dados da deficiência ainda: registre na linha do tempo.'}</p>
                  <a className={styles.atalho} href={`/casos/${processo.id}/deficiencia`}>
                    Linha do tempo da deficiência
                  </a>
                </section>
              )}

              {processo.beneficio === 'loas-deficiente' && <CartaoDaCrianca processoId={processo.id} perfil={perfil?.id} nome={perfil?.usuario ?? 'Advogada'} />}

              {!p.semRoteiro && (
                <section className={styles.cartao} aria-labelledby="matriz">
                  <h2 id="matriz" className={styles.cartaoTitulo}>
                    Roteiro do benefício · o que o documento precisa abordar
                  </h2>
                  <p className={proprio.detalhe}>
                    {analise.roteiro && (
                      <>
                        {analise.roteiro.nome}, versão {analise.roteiro.versao} ·{' '}
                        <a href={`/roteiros/${analise.roteiro.id}`}>ver o roteiro</a> ·{' '}
                      </>
                    )}
                    {analise.motivo ? (
                      'Confira cada item pela sua leitura dos documentos.'
                    ) : (
                      <>
                        A IA sugere <span className={proprio[analise.sugestao === 'sem-roteiro' ? 'pendente' : analise.sugestao]}>{NOMES_DO_PARECER[analise.sugestao]}</span>{' '}
                        em {curta(analise.quando)}. Confirme ou corrija cada item.
                      </>
                    )}
                  </p>
                  {/* GGVP-134 (CA4, CA5): a sugestão da IA vem marcada, com o alerta e as fontes; sem a IA, o motivo. */}
                  {analise.motivo && <p className={passo.dica}>{analise.motivo}</p>}
                  {analise.ia && (
                    <>
                      <span className={`${passo.selo} ${passo.seloAlerta}`}>Sugestão da IA · quem registra o parecer é você (G17)</span>
                      {analise.ia.alertas.map((a) => (
                        <p key={a} className={passo.erroCampo} role="alert">
                          Atenção: {a}.
                        </p>
                      ))}
                      <p className={passo.dica}>
                        Fontes: {analise.ia.fontes.join(' · ')} ({analise.ia.modelo})
                      </p>
                    </>
                  )}
                  <h3 className={proprio.secao}>Itens obrigatórios</h3>
                  <ul className={proprio.itens} aria-label="Itens obrigatórios">
                    {obrigatorios.map(linhaDoItem)}
                  </ul>
                  <h3 className={proprio.secao}>Contradições que bloqueiam (G18)</h3>
                  <ul className={proprio.itens} aria-label="Contradições que bloqueiam">
                    {contradicoes.map(linhaDoItem)}
                  </ul>
                  {analise.complementares.length > 0 && <p className={proprio.detalhe}>Complementares do roteiro: {analise.complementares.join(' · ')}.</p>}
                </section>
              )}

              <section className={styles.cartao} aria-labelledby="documentos">
                <h2 id="documentos" className={styles.cartaoTitulo}>
                  Documentos analisados
                </h2>
                <ul className={proprio.lista} aria-label="Documentos analisados">
                  {analise.documentos.map((d) => (
                    <li key={d.id} className={proprio.documento}>
                      <span className={proprio.pdf} aria-hidden="true">
                        PDF
                      </span>
                      <span>
                        {nomeTipo(d.tipo)} · {isoParaData(d.data)}
                        <span className={proprio.detalhe}>
                          <br />
                          {[d.emitente, d.resumo].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.cartao} aria-labelledby="decisao">
                <h2 id="decisao" className={styles.cartaoTitulo}>
                  A documentação médica é suficiente para o benefício?
                </h2>
                <div className={styles.opcoes} role="radiogroup" aria-labelledby="decisao">
                  {DECISOES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={decisao === d.id}
                      className={styles.opcao}
                      disabled={d.id === 'suficiente' && comContradicao}
                      onClick={() => setDecisao(d.id)}
                    >
                      {d.texto}
                    </button>
                  ))}
                </div>
                {comContradicao && <p className={proprio.erro}>Há contradição conferida: o parecer fica Contraditório e o caso não avança (G18).</p>}
                {final && final !== 'suficiente' && (
                  <label className={proprio.campo}>
                    O que o documento deve abordar (sem sugerir diagnóstico, CID, grau ou conclusão, G20) *
                    <textarea rows={6} maxLength={TEXTO_MAXIMO_DO_PARECER} value={textoAbordar} onChange={(e) => setAbordar(e.target.value)} />
                    <span className={proprio.detalhe}>Sugerido pela IA com as perguntas do roteiro para o que falta. Confira e ajuste antes de registrar.</span>
                    {g20 && <span className={proprio.erro}>{g20}</span>}
                  </label>
                )}
              </section>

              <p className={styles.aviso}>
                Só a sênior dispensa, com justificativa; documento que contradiz o requisito bloqueia (G17/G18).
                {perfil?.id.startsWith('senior') && (
                  <>
                    {' '}
                    <a className={styles.avisoLink} href={`/casos/${processo.id}/parecer/dispensa`}>
                      Dispensar o parecer
                    </a>
                  </>
                )}
              </p>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={motivo !== null || registrando} onClick={registrar}>
                  {registrando ? 'registrando…' : 'Registrar parecer'}
                </button>
                {motivo && <p className={styles.motivo}>{motivo}</p>}
              </div>
              {erro && (
                <p role="alert" className={styles.motivo}>
                  {erro}
                </p>
              )}

              <section className={styles.cartao} aria-labelledby="historico">
                <h2 id="historico" className={styles.cartaoTitulo}>
                  Histórico do parecer
                </h2>
                {p.historico.length === 0 ? (
                  <p className={proprio.detalhe}>Nenhum parecer registrado ainda: a sugestão da IA, sozinha, não vale (G17).</p>
                ) : (
                  <ul className={proprio.lista} aria-label="Histórico do parecer">
                    {[...p.historico].reverse().map((h) => (
                      <li key={h.quando}>
                        <span className={proprio[h.situacao]}>{NOMES_DO_PARECER[h.situacao]}</span> {h.quem} · {dataHora(h.quando)}
                        {h.roteiro ? ` · roteiro ${h.roteiro.nome}, versão ${h.roteiro.versao}` : ' · conferência manual'}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.21M.</p>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <p>
            • Se «Insuficiente — pedir complemento»: O que o documento deve abordar (sem sugerir diagnóstico, CID, grau ou conclusão, G20)*
          </p>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Registrar parecer» só habilita com cada item conferido, a decisão respondida e os campos com * preenchidos.</p>
        </aside>
      </main>
      <AbaSuporte />
      {resultado && <ParecerMedico processoId={processoId} funcao="Atendimento" aoFechar={() => setResultado(false)} />}
    </>
  )
}
