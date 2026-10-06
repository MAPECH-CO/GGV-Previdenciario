import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { obterParecer, doJuridico, type ParecerNaTela } from '../dados/parecer.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './Parecer.module.css'

// Figma: "Laudo novo · resumo e comparação da IA (D1.21M)" (2087:2). Tela da advogada (GGVP-20, CA6 e CA7).

export function AnalisarLaudoNovo({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Advogada')
  const juridico = doJuridico(perfil?.id)
  const [p, setP] = useState<ParecerNaTela | null | undefined>(undefined)
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
        <title>Analisar laudo novo · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{p === null ? 'Caso não encontrado' : 'Abrindo o laudo novo…'}</h1>
        {p === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, beneficio, laudoNovoEm } = p
  const comparacao = p.juridico?.comparacao
  const curta = (iso: string) => dataCurta(iso, hoje)

  return (
    <>
      <title>{`${ficha.nome} · Analisar laudo novo · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${processo.numero ? `Processo ${processo.numero} · ` : ''}${ficha.nome.split(' ')[0]}`} inicio={perfil?.inicio ?? '/advogada'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.21M · Conferir o laudo novo (passo do BPMN)">
                D1.21M
              </span>
              <span className={proprio.advogada}>Advogada</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Analisar laudo novo
            </h1>
            <p className={styles.subtitulo}>
              {beneficio}
              {laudoNovoEm ? ` · enviado pelo Atendimento em ${curta(laudoNovoEm)}` : ''}
            </p>
          </div>

          {!juridico ? (
            <p className={styles.aviso} role="status">
              O laudo e a comparação são do Jurídico: dado de saúde só aparece para a advogada. Você está como {perfil?.rotulo ?? 'outro perfil'}.
            </p>
          ) : !laudoNovoEm || !comparacao ? (
            <section className={styles.cartao} aria-labelledby="sem-laudo">
              <h2 id="sem-laudo" className={styles.cartaoTitulo}>
                Nenhum laudo novo esperando a análise
              </h2>
              <p className={proprio.detalhe}>O último laudo já foi conferido. O parecer do caso está na tela do parecer.</p>
              <a className={styles.atalho} href={`/casos/${processo.id}/parecer`}>
                Abrir o parecer
              </a>
            </section>
          ) : (
            <>
              <section className={styles.instrucoes} aria-labelledby="resumo-ia">
                <div className={styles.instrucoesTopo}>
                  <span className={styles.estrela} aria-hidden="true">
                    ✦
                  </span>
                  <h2 id="resumo-ia" className={styles.instrucoesTitulo}>
                    Resumo da IA · laudo novo de {curta(comparacao.novo.data)}
                  </h2>
                </div>
                <ul className={proprio.resumo}>
                  {comparacao.resumo.map((linha) => (
                    <li key={linha}>{linha}</li>
                  ))}
                </ul>
                <p className={styles.nota}>Resumo e comparação montados pela IA. Confira antes de agir.</p>
              </section>

              <section className={styles.cartao} aria-labelledby="comparacao-titulo" id="comparacao">
                <h2 id="comparacao-titulo" className={styles.cartaoTitulo}>
                  {comparacao.anterior ? `Comparação com o último laudo (${curta(comparacao.anterior.data)})` : 'O laudo novo é o primeiro do caso'}
                </h2>
                <table className={proprio.comparacao} aria-labelledby="comparacao-titulo">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="so-leitor">O que compara</span>
                      </th>
                      <th scope="col">{comparacao.anterior ? `Último laudo · ${curta(comparacao.anterior.data)}` : 'Antes'}</th>
                      <th scope="col">Laudo novo · {curta(comparacao.novo.data)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparacao.linhas.map((l) => (
                      <tr key={l.rotulo}>
                        <th scope="row">{l.rotulo}</th>
                        <td>{l.anterior}</td>
                        <td className={l.mudou ? proprio.mudou : undefined} data-mudou={l.mudou || undefined}>
                          {l.novo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={proprio.detalhe}>Dados de exemplo. Em laranja, o que mudou. A IA mostra o que está nos documentos; quem confere é a advogada.</p>
              </section>

              <section className={styles.cartao} aria-labelledby="diante-do-roteiro">
                <h2 id="diante-do-roteiro" className={styles.cartaoTitulo}>
                  Diante do roteiro{p.roteiro ? ` · ${p.roteiro.nome}, versão ${p.roteiro.versao}` : ''}
                </h2>
                <dl className={proprio.lista}>
                  <dt className={proprio.secao}>Passa a cobrir</dt>
                  <dd>{comparacao.passaACobrir.length > 0 ? comparacao.passaACobrir.join('; ') : 'Nada que os documentos anteriores não cobriam.'}</dd>
                  <dt className={proprio.secao}>Ainda falta</dt>
                  <dd>{comparacao.aindaFalta.length > 0 ? comparacao.aindaFalta.join('; ') : 'Nada: todos os itens obrigatórios estão cobertos.'}</dd>
                </dl>
              </section>

              <p className={styles.aviso}>A IA só compara: não sugere CID, grau nem conclusão (G20). Quem confirma o laudo e o parecer de suficiência (G17) é a advogada.</p>

              <div className={styles.rodape}>
                <a className={styles.principalBotao} href={`/casos/${processo.id}/parecer`}>
                  Ir para o parecer (D1.21M)
                </a>
              </div>
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>Laudo novo (D1.21M): o Atendimento sobe, a IA resume e compara, e o Jurídico confere.</p>
          <h3 className={styles.ladoSecao}>O que a IA fez</h3>
          <ul className={styles.ladoLista}>
            <li>• Leu o laudo novo e o último laudo</li>
            <li>• Montou o resumo e a comparação</li>
            <li>• Não sugeriu CID, grau nem conclusão</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>O parecer de suficiência (G17) só muda com a confirmação da advogada. Dado de saúde só aparece para o Jurídico.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
