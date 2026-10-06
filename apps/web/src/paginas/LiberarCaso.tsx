import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { ParecerMedico } from '../componentes/ParecerMedico.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { liberarAoJuridico, obterLiberacao, type CasoParaLiberar } from '../dados/liberacao.ts'
import { agora } from '../dados/servidor.ts'
import { juntar } from '../regras/checklist.ts'
import { dataCurta, dataHora, hojeIso, hora } from '../regras/datas.ts'
import { ehMedico } from '../regras/leitura.ts'
import { PERFIS, parecerEmOrdem, travaDaLiberacao, type Perfil } from '../regras/liberacao.ts'
import styles from './Balcao.module.css'
import documentos from './ConferirDocumentos.module.css'
import proprio from './LiberarCaso.module.css'

// Figma: step_D1.24 "Liberar ao Jurídico" (10:264), no visual das telas de passo (GGVP-18).

export function LiberarCaso({ processoId, perfil = 'documentacao' }: { processoId: string; /** Sem login ainda: ?perfil= na rota (CA4). */ perfil?: Perfil }) {
  const [caso, setCaso] = useState<CasoParaLiberar | null | undefined>(undefined)
  const [conferiChecklist, setConferiChecklist] = useState(false)
  const [conferiAssinaturas, setConferiAssinaturas] = useState(false)
  const [liberando, setLiberando] = useState(false)
  const [erro, setErro] = useState('')
  // A janela do parecer médico (GGVP-20), na visão da Documentação.
  const [parecerAberto, setParecerAberto] = useState(false)
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterLiberacao(processoId).then((c) => {
      if (valendo) setCaso(c)
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!caso) {
    return (
      <main className={proprio.status}>
        <title>Liberar ao Jurídico · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{caso === null ? 'Caso não encontrado' : 'Abrindo o caso…'}</h1>
        {caso === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, beneficio, checklist, parecer, precisaParecer, liberacao } = caso
  const hoje = hojeIso(agora())
  const daDocumentacao = perfil === 'documentacao'
  const recebidos = checklist.itens.filter((i) => i.situacao === 'recebido')
  const parecerOk = parecerEmOrdem(processo.beneficio, parecer)
  const trava = travaDaLiberacao({ checklist, beneficio: processo.beneficio, nomeBeneficio: beneficio, parecer, conferiChecklist, conferiAssinaturas })
  const confirmado = parecer?.quem ? ` · confirmado por ${parecer.quem}${parecer.data ? `, ${dataCurta(parecer.data, hoje)}` : ''}` : ''
  // O que o registro diz e, se não está em ordem, o que falta (GGVP-33, CA1 e CA4).
  const textoParecer = !precisaParecer
    ? `Parecer médico: não se aplica a ${beneficio} — registro, você não marca`
    : parecer?.contradicoes?.length
      ? 'Parecer médico (G18): a IA achou contradição num documento que o Jurídico ainda não conferiu — registro, você não marca'
      : parecer?.situacao === 'dispensado'
      ? `Parecer médico dispensado por duas sêniores (G17) · ${parecer.quem}${parecer.data ? `, ${dataCurta(parecer.data, hoje)}` : ''} — registro, você não marca`
      : parecerOk
        ? `Parecer médico Suficiente (G17)${confirmado} — registro, você não marca`
        : parecer?.situacao === 'contraditorio'
          ? `Parecer médico Contraditório (G18)${confirmado}: o caso não avança — registro do Jurídico, você não marca`
          : parecer?.situacao === 'insuficiente'
            ? `Parecer médico Insuficiente (G17)${confirmado}: falta o complemento do médico — registro do Jurídico, você não marca`
            : parecer?.situacao === 'pendente'
              ? 'Parecer médico (G17): a IA analisou, falta a conferência do Jurídico — registro, você não marca'
              : 'Parecer médico (G17): ainda não está Suficiente — registro do Jurídico, você não marca'

  async function liberar() {
    if (travado.current || trava) return
    travado.current = true
    setLiberando(true)
    setErro('')
    try {
      await liberarAoJuridico(processoId, { perfil, conferiChecklist, conferiAssinaturas })
      setCaso(await obterLiberacao(processoId))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para liberar.')
    } finally {
      travado.current = false
      setLiberando(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Liberar ao Jurídico · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${processo.numero ? `Processo ${processo.numero} · ` : ''}${ficha.nome.split(' ')[0]}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.24 · Liberar ao Jurídico (passo do BPMN)">
                D1.24
              </span>
              <span className={styles.codigo}>Documentação</span>
              <span className={styles.beneficio}>◆ {beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Liberar ao Jurídico
            </h1>
            <p className={styles.subtitulo}>{beneficio} · conferir a documentação</p>
          </div>

          <InstrucoesPasso beneficio={beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId}>
            Antes de liberar o caso de {ficha.nome.split(' ')[0]} ao Jurídico, confira o kit do {beneficio}: {juntar(checklist.itens.map((i) => i.nome))}.
            {precisaParecer && ' O parecer médico precisa estar "Suficiente", confirmado por pessoa (G17).'} Abra cada documento antes de liberar.
          </InstrucoesPasso>

          {liberacao ? (
            <section className={styles.feito} aria-labelledby="liberado">
              <h2 id="liberado" className={styles.feitoTitulo}>
                ✓ Liberado ao Jurídico às {hora(liberacao.quando)}
              </h2>
              <p>
                {liberacao.quem} liberou em {dataHora(liberacao.quando)}. O caso entrou na fila da sênior, que confere antes do INSS (D2.01). Ficou no
                histórico: «Caso liberado ao Jurídico pela Documentação».
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
          ) : daDocumentacao ? (
            <>
              <section className={styles.cartao} aria-labelledby="conferir">
                <h2 id="conferir" className={styles.cartaoTitulo}>
                  Conferir
                </h2>
                <div className={proprio.conferir}>
                  <label className={proprio.item}>
                    <input type="checkbox" checked={conferiChecklist} disabled={!checklist.completo} onChange={(e) => setConferiChecklist(e.target.checked)} />
                    Checklist do {beneficio}: {recebidos.length} de {checklist.itens.length} itens recebidos — confira e marque
                  </label>
                  <label className={proprio.item}>
                    <input type="checkbox" checked={parecerOk} disabled readOnly />
                    <span className={proprio.registro}>{textoParecer}</span>
                  </label>
                  <label className={proprio.item}>
                    <input type="checkbox" checked={conferiAssinaturas} onChange={(e) => setConferiAssinaturas(e.target.checked)} />
                    Assinaturas e datas preenchidas — confira e marque
                  </label>
                </div>
              </section>
              <p className={styles.aviso}>
                O parecer Suficiente vem do registro do G17 (quem confirmou e quando). «Liberar ao Jurídico» só habilita com as duas conferências suas marcadas.
              </p>
            </>
          ) : (
            <p className={proprio.status} role="status">
              Situação: esperando a Documentação · ADM liberar ao Jurídico. Você está como {PERFIS[perfil]}: vê só a situação; quem aperta o OK é a
              Documentação · ADM.
            </p>
          )}

          <section className={styles.cartao} aria-labelledby="resumo">
            <h2 id="resumo" className={styles.cartaoTitulo}>
              Resumo do que foi coletado
            </h2>
            <dl className={proprio.resumo}>
              <dt>Ficha</dt>
              <dd className={proprio.destaque}>{ficha.fichaAtendimentoPreenchida ? 'preenchida' : 'pendente'}</dd>
              <dd>
                <a className={proprio.abrir} href={`/clientes/${ficha.id}`} aria-label="Abrir a ficha">
                  Abrir ›
                </a>
              </dd>
              <dt>Entrevista</dt>
              <dd className={proprio.destaque}>{ficha.transcricoes > 0 ? 'gravada e transcrita' : 'sem transcrição'}</dd>
              <dd>
                {/* Transcrições são da GGVP-102. */}
                <button type="button" className={proprio.abrir} aria-disabled="true" aria-label="Abrir a entrevista">
                  Abrir ›
                </button>
              </dd>
              <dt>Benefício</dt>
              <dd>{beneficio}</dd>
              <dd />
              <dt>Parecer médico</dt>
              <dd className={proprio.destaque}>
                {!precisaParecer
                  ? 'não se aplica'
                  : parecer?.situacao === 'dispensado'
                    ? 'Dispensado'
                    : parecerOk
                      ? 'Suficiente'
                      : parecer?.situacao === 'insuficiente'
                        ? 'Insuficiente'
                        : parecer?.situacao === 'contraditorio'
                          ? 'Contraditório'
                          : 'pendente'}
              </dd>
              <dd>
                <button type="button" className={proprio.abrir} aria-label="Abrir o parecer médico" onClick={() => setParecerAberto(true)}>
                  Abrir ›
                </button>
              </dd>
            </dl>
          </section>

          <section className={styles.cartao} aria-labelledby="documentos">
            <h2 id="documentos" className={styles.cartaoTitulo}>
              Documentos (abrir cada um)
            </h2>
            {recebidos.length === 0 ? (
              <p className={documentos.detalhe}>Nenhum documento do checklist recebido ainda.</p>
            ) : (
              <ul className={documentos.documentos} aria-label="Documentos recebidos">
                {recebidos.map((i) => (
                  <li key={i.tipo} className={documentos.documento}>
                    <span className={documentos.icone} aria-hidden="true">
                      ▤
                    </span>
                    <span className={documentos.info}>
                      <span className={documentos.nome}>{i.nome}</span>
                      <span className={documentos.detalhe}>{i.tipo === 'contrato' ? 'assinado' : 'recebido'}</span>
                    </span>
                    {ehMedico(i.tipo) ? (
                      <span className={documentos.detalhe}>o conteúdo fica com o Jurídico</span>
                    ) : (
                      <a className={documentos.abrir} href={`/clientes/${ficha.id}`} aria-label={`Abrir ${i.nome}`}>
                        Abrir
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!liberacao && daDocumentacao && (
            <div className={styles.rodape}>
              <button type="button" className={styles.principalBotao} disabled={trava !== null || liberando} onClick={liberar}>
                {liberando ? 'liberando…' : 'Liberar ao Jurídico'}
              </button>
              {trava && <p className={styles.motivo}>{trava}</p>}
            </div>
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
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.24.</p>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>«Liberar ao Jurídico» só habilita com os três itens de «Conferir» marcados.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>
            Quem libera o caso é a Documentação (resposta do Lucas, 28/09). Depois, a sênior confere antes do INSS (D2.01): nada é protocolado sem o OK dela
            (G2).
          </p>
        </aside>
      </main>
      <AbaSuporte />
      {parecerAberto && <ParecerMedico processoId={processoId} funcao="Documentação" aoFechar={() => setParecerAberto(false)} />}
    </>
  )
}
