import { useEffect, useRef, useState } from 'react'
import { dataParaIso, isoParaData, normalizarData } from '../campos.ts'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CartaoBoasVindas } from '../componentes/CartaoBoasVindas.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { obterAcidente, salvarAcidente, type AcidenteNaTela } from '../dados/acidente.ts'
import { TABELA_DO_ACIDENTE, conferirChecklist, obterChecklist, type ChecklistDoCaso, type ConferenciaDoChecklist } from '../dados/checklist.ts'
import { doJuridico } from '../dados/parecer.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import {
  CATEGORIAS,
  CIRCUNSTANCIAS,
  EXIGENCIAS,
  bloqueioDoAcidente,
  complementares,
  especie,
  motivoParaNaoSalvar,
  paraDados,
  type Categoria,
  type Circunstancia,
  type ComValvula,
  type ValoresDoAcidente,
} from '../regras/acidente.ts'
import { jaEraCliente } from '../regras/boasVindas.ts'
import { CONDICOES, juntar, motivoParaNaoLiberar, type ItemDoChecklist } from '../regras/checklist.ts'
import { dataHora, hojeIso, hora } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './ConferirChecklist.module.css'
import campos from './Deficiencia.module.css'

// Figma: step_D1.21 "Checklist do benefício e boas-vindas" (1818:2), no visual das telas de passo (GGVP-91).

const SELO: Record<ItemDoChecklist['situacao'], { texto: string; classe: string }> = {
  recebido: { texto: 'ok', classe: proprio.ok },
  pendente: { texto: 'falta', classe: proprio.falta },
  problema: { texto: 'problema', classe: proprio.problema },
}

/** A linha de apoio do item: por que falta ou por que entrou no checklist; no Auxílio-Acidente, a exigência (GGVP-47). */
function detalhe(item: ItemDoChecklist): string {
  const origem =
    item.de === 'condicao' && item.condicao ? `entra porque o cliente ${CONDICOES[item.condicao]}` : item.de === 'entrevista' ? 'pedido na entrevista' : ''
  const exigencia = item.exigencia ? `${EXIGENCIAS[item.exigencia]}${item.exigencia === 'desejavel' ? ': não conta para o completo' : ''}` : ''
  const motivo = item.situacao === 'recebido' || item.motivo === 'falta' ? '' : item.motivo
  return [exigencia, motivo, origem].filter(Boolean).join(' · ')
}

/** O selo do item: o que não conta para o completo não aparece como "falta" (GGVP-47, CA3). */
function selo(item: ItemDoChecklist): { texto: string; classe: string } {
  if (item.situacao !== 'pendente' || !item.naoConta) return SELO[item.situacao]
  return item.motivo?.startsWith('o empregador') ? { texto: 'pendência', classe: proprio.problema } : { texto: 'não conta', classe: proprio.neutro }
}

const VAZIO: ValoresDoAcidente = { circunstancia: '', categoria: '', acidenteEm: '', auxilioAnterior: false, recusados: [] }

/** A tela começa do que foi salvo; sem nada salvo, do que a segunda ficha diz. */
function valoresDe(t: AcidenteNaTela): ValoresDoAcidente {
  if (t.dados) return { ...t.dados, acidenteEm: isoParaData(t.dados.acidenteEm) ?? '' }
  return { ...VAZIO, ...t.sugestao }
}

/**
 * A circunstância do acidente (GGVP-47): define a espécie (B94 ou B36) e o que é obrigatório no checklist. Não há quadro
 * no Figma; segue o visual das telas de passo. A Documentação ou o Jurídico salvam; o servidor confere de novo.
 */
function CartaoDoAcidente({ processoId, aoSalvar }: { processoId: string; aoSalvar: () => void }) {
  const perfil = usePerfil('Documentação')
  const pode = perfil?.id === 'documentacao' || doJuridico(perfil?.id)
  const [tela, setTela] = useState<AcidenteNaTela | null | undefined>(undefined)
  const [v, setV] = useState<ValoresDoAcidente>(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterAcidente(processoId).then((t) => {
      if (!valendo) return
      setTela(t)
      if (t) setV(valoresDe(t))
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!tela) return null

  const mudar = (x: Partial<ValoresDoAcidente>) => {
    setV((a) => ({ ...a, ...x }))
    setAviso('')
  }
  const motivo = motivoParaNaoSalvar(v, hoje)
  const dados = paraDados(v, hoje)
  // CAT e PPP só aparecem para recusar quando a circunstância e a categoria pedem (CA2).
  const comValvula: ComValvula[] =
    v.circunstancia && v.categoria
      ? complementares(TABELA_DO_ACIDENTE, { circunstancia: v.circunstancia, categoria: v.categoria, acidenteEm: '', auxilioAnterior: false, recusados: [] })
          .map((c) => c.tipo)
          .filter((t): t is ComValvula => t === 'cat' || t === 'ppp')
      : []
  const bloqueio = dados && bloqueioDoAcidente(dados)
  const recusar = (tipo: ComValvula, sim: boolean) => mudar({ recusados: sim ? [...v.recusados, tipo] : v.recusados.filter((r) => r !== tipo) })

  async function salvar() {
    if (travado.current || !dados) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const recusados = dados.recusados.filter((r) => comValvula.includes(r))
      const salvo = await salvarAcidente(processoId, { ...dados, recusados }, { perfil: perfil?.id, nome: perfil?.usuario ?? '' })
      setTela({ ...tela, dados: salvo })
      setAviso('Circunstância salva: o checklist foi refeito.')
      aoSalvar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para salvar a circunstância.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  return (
    <section className={styles.cartao} aria-labelledby="acidente">
      <div className={proprio.cartaoTopo}>
        <h2 id="acidente" className={styles.cartaoTitulo}>
          Circunstância do acidente
        </h2>
        {v.circunstancia && <span className={proprio.especie}>{especie(v.circunstancia)}</span>}
      </div>
      <p className={proprio.itemDetalhe}>
        A circunstância define a espécie e o que é obrigatório no checklist.{' '}
        {tela.dados
          ? `Salva por ${tela.dados.quem} em ${dataHora(tela.dados.quando)}.`
          : tela.sugestao
            ? 'A segunda ficha já sugere o que está preenchido: confira antes de salvar.'
            : 'Ainda não foi marcada.'}
      </p>
      <div className={campos.campos}>
        <label className={campos.campo}>
          Circunstância
          <select value={v.circunstancia} disabled={!pode} onChange={(e) => mudar({ circunstancia: e.target.value as Circunstancia | '' })}>
            <option value="">escolha…</option>
            {Object.entries(CIRCUNSTANCIAS).map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <label className={campos.campo}>
          Categoria do segurado
          <select value={v.categoria} disabled={!pode} onChange={(e) => mudar({ categoria: e.target.value as Categoria | '' })}>
            <option value="">escolha…</option>
            {Object.entries(CATEGORIAS).map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <label className={campos.campo}>
          Data do acidente
          <input
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={v.acidenteEm}
            disabled={!pode}
            onChange={(e) => mudar({ acidenteEm: e.target.value })}
            onBlur={() => dataParaIso(normalizarData(v.acidenteEm)) && mudar({ acidenteEm: normalizarData(v.acidenteEm) })}
          />
        </label>
      </div>
      <label className={proprio.marcar}>
        <input type="checkbox" checked={v.auxilioAnterior} disabled={!pode} onChange={(e) => mudar({ auxilioAnterior: e.target.checked })} />
        Houve auxílio por incapacidade temporária antes (a cópia do processo entra no checklist)
      </label>
      {comValvula.map((tipo) => (
        <label key={tipo} className={proprio.marcar}>
          <input type="checkbox" checked={v.recusados.includes(tipo)} disabled={!pode} onChange={(e) => recusar(tipo, e.target.checked)} />
          O empregador recusou {tipo === 'cat' ? 'a CAT' : 'o PPP'} (vira pendência e não trava)
        </label>
      ))}
      {bloqueio && <p className={styles.aviso}>{bloqueio}</p>}
      {pode ? (
        <div className={styles.rodape}>
          <button type="button" className={styles.principalBotao} disabled={!!motivo || salvando} onClick={salvar}>
            {salvando ? 'salvando…' : 'Salvar a circunstância'}
          </button>
          {motivo && <p className={styles.motivo}>{motivo}</p>}
        </div>
      ) : (
        <p className={styles.motivo}>Só a Documentação ou o Jurídico marcam a circunstância do acidente.</p>
      )}
      {aviso && (
        <p role="status" className={styles.motivo}>
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className={styles.motivo}>
          {erro}
        </p>
      )}
    </section>
  )
}


export function ConferirChecklist({ processoId }: { processoId: string }) {
  // undefined: abrindo; null: o caso não existe.
  const [caso, setCaso] = useState<ChecklistDoCaso | null | undefined>(undefined)
  const [feito, setFeito] = useState<ConferenciaDoChecklist | null>(null)
  const [conferindo, setConferindo] = useState(false)
  const [erro, setErro] = useState('')
  // Sobe a cada conferência: as boas-vindas saem das pendências do checklist conferido (GGVP-97).
  const [versao, setVersao] = useState(0)
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)
  // Sobe quando a circunstância do acidente é salva: o checklist é refeito (GGVP-47).
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let valendo = true
    obterChecklist(processoId).then((c) => {
      if (valendo) setCaso(c)
    })
    return () => {
      valendo = false
    }
  }, [processoId, recarga])

  if (!caso) {
    return (
      <main className={proprio.vazia}>
        <title>Conferir checklist · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{caso === null ? 'Caso não encontrado' : 'Abrindo o checklist…'}</h1>
        {caso === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, beneficio, checklist, conferencia } = caso
  const trava = motivoParaNaoLiberar(checklist, beneficio)

  async function concluir() {
    if (travado.current) return
    travado.current = true
    setConferindo(true)
    setErro('')
    try {
      setFeito(await conferirChecklist(processoId))
      setVersao((v) => v + 1)
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
            <p className={styles.subtitulo}>{jaEraCliente(ficha, processo.id) ? 'já era cliente · sem boas-vindas' : 'cliente novo · boas-vindas'}</p>
          </div>

          <InstrucoesPasso beneficio={beneficio} de={ficha.nome} fichaId={ficha.id} processoId={processoId}>
            Situação do checklist calculada pelo sistema a partir dos documentos arquivados e registro das boas-vindas. Confira cada
            item: documento sem assinatura ou com a data em branco não vale (G1), e documento em quarentena não conta.
          </InstrucoesPasso>

          {processo.beneficio === 'auxilio-acidente' && <CartaoDoAcidente processoId={processoId} aoSalvar={() => setRecarga((r) => r + 1)} />}

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
            {checklist.bloqueio && <p className={styles.aviso}>{checklist.bloqueio}</p>}
            <ul className={proprio.itens} aria-label={`Checklist · ${beneficio}`}>
              {checklist.itens.map((item) => {
                const texto = detalhe(item)
                const s = selo(item)
                return (
                  <li key={item.tipo} className={proprio.item}>
                    <span className={proprio.itemTexto}>
                      <span className={proprio.itemNome}>{item.nome}</span>
                      {texto && <span className={proprio.itemDetalhe}>{texto}</span>}
                    </span>
                    <span className={s.classe}>{s.texto}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          <CartaoBoasVindas processoId={processo.id} nome={ficha.nome} versao={versao} />

          {trava && <p className={styles.trava}>Liberar ao Jurídico: bloqueado. {trava}</p>}

          <p className={proprio.nota}>
            Lista de documentos de cada benefício: configuração do escritório (GGVP-104), com os nomes da lista única de
            documentos. O portal nasce com a do LOAS; as declarações de moradia, união estável e separação de fato entram quando o
            caso pede. O Auxílio-Acidente tem o kit e a tabela por circunstância: os desejáveis aparecem, mas não contam para o
            completo (G1).
          </p>

          {feito ? (
            <section className={styles.feito} aria-labelledby="conferido">
              <h2 id="conferido" className={styles.feitoTitulo}>
                ✓ Conferido às {hora(feito.quando)}
              </h2>
              <p>
                {feito.completo
                  ? 'Checklist completo: o caso segue para liberar ao Jurídico (D1.24).'
                  : checklist.bloqueio && feito.faltam.length === 0
                    ? `Checklist travado: ${checklist.bloqueio} O caso fica na Documentação.`
                    : checklist.temLista
                    ? `Checklist incompleto. Falta: ${juntar(feito.faltam)}. A cobrança das pendências foi para o Atendimento (D1.23).`
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
                {conferindo ? 'concluindo…' : checklist.faltam.length > 0 ? 'Gerar cobrança das pendências' : 'Concluir a conferência'}
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
