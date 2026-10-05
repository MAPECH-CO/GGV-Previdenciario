import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { conferirChecklist, obterChecklist, type ChecklistDoCaso, type ConferenciaDoChecklist } from '../dados/checklist.ts'
import { CONDICOES, juntar, motivoParaNaoLiberar, type ItemDoChecklist } from '../regras/checklist.ts'
import { dataHora, hora } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './ConferirChecklist.module.css'

// Figma: step_D1.21 "Checklist do benefício e boas-vindas" (1818:2), no visual das telas de passo (GGVP-91).

const SELO: Record<ItemDoChecklist['situacao'], { texto: string; classe: string }> = {
  recebido: { texto: 'ok', classe: proprio.ok },
  pendente: { texto: 'falta', classe: proprio.falta },
  problema: { texto: 'problema', classe: proprio.problema },
}

/** A linha de apoio do item: por que falta ou por que entrou no checklist. */
function detalhe(item: ItemDoChecklist): string {
  const origem =
    item.de === 'condicao' && item.condicao ? `entra porque o cliente ${CONDICOES[item.condicao]}` : item.de === 'entrevista' ? 'pedido na entrevista' : ''
  const motivo = item.situacao === 'recebido' || item.motivo === 'falta' ? '' : item.motivo
  return [motivo, origem].filter(Boolean).join(' · ')
}

export function ConferirChecklist({ processoId }: { processoId: string }) {
  // undefined: abrindo; null: o caso não existe.
  const [caso, setCaso] = useState<ChecklistDoCaso | null | undefined>(undefined)
  const [feito, setFeito] = useState<ConferenciaDoChecklist | null>(null)
  const [conferindo, setConferindo] = useState(false)
  const [erro, setErro] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterChecklist(processoId).then((c) => {
      if (valendo) setCaso(c)
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!caso) {
    return (
      <main className={proprio.vazia}>
        <title>Conferir checklist · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{caso === null ? 'Caso não encontrado' : 'Abrindo o checklist…'}</h1>
        {caso === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, beneficio, checklist, conferencia } = caso
  const trava = motivoParaNaoLiberar(checklist, beneficio)

  async function concluir() {
    if (travado.current) return
    travado.current = true
    setConferindo(true)
    setErro('')
    try {
      setFeito(await conferirChecklist(processoId))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para concluir a conferência.')
    } finally {
      travado.current = false
      setConferindo(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Conferir checklist · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Documentação" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.21 · Conferir o checklist (passo do BPMN)">
                D1.21
              </span>
              <span className={styles.codigo}>Documentação</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Conferir checklist
            </h1>
            <p className={styles.subtitulo}>
              {beneficio} · {checklist.completo ? 'completo' : 'incompleto'}
            </p>
          </div>

          <InstrucoesPasso beneficio={beneficio} de={ficha.nome} fichaId={ficha.id}>
            Situação do checklist calculada pelo sistema a partir dos documentos arquivados. Confira cada item: documento sem
            assinatura ou com a data em branco não vale (G1), e documento em quarentena não conta.
          </InstrucoesPasso>

          <section className={styles.cartao} aria-labelledby="checklist">
            <div className={proprio.cartaoTopo}>
              <h2 id="checklist" className={styles.cartaoTitulo}>
                Checklist · {beneficio}
              </h2>
              <span className={checklist.completo ? proprio.completo : proprio.incompleto}>
                <span className="so-leitor">Situação: </span>
                {checklist.completo ? 'completo' : 'incompleto'}
              </span>
            </div>
            {!checklist.temLista && (
              <p className={styles.aviso}>
                {beneficio} ainda não tem lista de documentos obrigatórios aprovada. O escritório monta a lista na configuração
                (GGVP-104); até lá, o caso não pode ser liberado ao Jurídico.
              </p>
            )}
            <ul className={proprio.itens} aria-label={`Checklist · ${beneficio}`}>
              {checklist.itens.map((item) => {
                const texto = detalhe(item)
                return (
                  <li key={item.tipo} className={proprio.item}>
                    <span className={proprio.itemTexto}>
                      <span className={proprio.itemNome}>{item.nome}</span>
                      {texto && <span className={proprio.itemDetalhe}>{texto}</span>}
                    </span>
                    <span className={SELO[item.situacao].classe}>{SELO[item.situacao].texto}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          {trava && <p className={styles.trava}>Liberar ao Jurídico: bloqueado. {trava}</p>}

          <p className={proprio.nota}>
            Lista de documentos de cada benefício: configuração do escritório (GGVP-104), com os nomes da lista única de
            documentos. O portal nasce com a do LOAS; as declarações de moradia, união estável e separação de fato entram quando o
            caso pede.
          </p>

          {feito ? (
            <section className={styles.feito} aria-labelledby="conferido">
              <h2 id="conferido" className={styles.feitoTitulo}>
                ✓ Conferido às {hora(feito.quando)}
              </h2>
              <p>
                {feito.completo
                  ? 'Checklist completo: o caso segue para liberar ao Jurídico (D1.24).'
                  : checklist.temLista
                    ? `Checklist incompleto. Falta: ${juntar(feito.faltam)}.`
                    : `Checklist sem lista aprovada para ${beneficio}: o caso fica na Documentação.`}{' '}
                A conferência ficou no histórico da ficha.
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
            <div className={styles.rodape}>
              <button type="button" className={styles.principalBotao} disabled={conferindo} onClick={concluir}>
                {conferindo ? 'concluindo…' : 'Concluir a conferência'}
              </button>
              {conferencia && (
                <p className={styles.motivo}>
                  Última conferência: {dataHora(conferencia.quando)} · {conferencia.completo ? 'completo' : 'incompleto'}
                </p>
              )}
            </div>
          )}
          {erro && (
            <p role="alert" className={styles.motivo}>
              {erro}
            </p>
          )}
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
