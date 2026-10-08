import { useId, useRef, useState } from 'react'
import { COLUNAS_DA_PLANILHA, ROTULO_BENEFICIO, type Beneficio, type LinhaDaImportacao, type RelatorioDaImportacao } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

// GGVP-146, parte 2: a gestão importa os clientes e os processos em andamento que o escritório já tem, de uma planilha
// (CSV). Primeiro a simulação, com o relatório; a gravação só com a confirmação sobre o mesmo relatório. As regras dos
// campos rodam no servidor, com a biblioteca `campos`.

type Gravado = { clientes: { novos: number }; processos: { novos: number }; linhasComErro: number }

/** O CSV do Excel em português vem em Windows-1252; o resto, em UTF-8. */
async function lerTexto(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
/** "a linha com erro fica de fora", "as 3 linhas com erro ficam de fora"; no passado, depois de gravar. */
const deFora = (n: number, passado = false) => `${n === 1 ? `a linha com erro ${passado ? 'ficou' : 'fica'}` : `as ${n} linhas com erro ${passado ? 'ficaram' : 'ficam'}`} de fora`

function oQueEntra(l: LinhaDaImportacao): string {
  const cliente = l.cliente === 'novo' ? 'cliente novo' : `cliente já cadastrado${l.nomeNoPortal ? ` (no portal: ${l.nomeNoPortal})` : ''}`
  const beneficio = l.beneficio ? ROTULO_BENEFICIO[l.beneficio as Beneficio] : 'benefício a definir'
  const processo = l.processo === 'sem-processo' ? 'sem processo' : `processo ${l.processo === 'novo' ? 'novo' : 'já cadastrado'}: ${beneficio}, ${l.fase}`
  return `Linha ${l.linha} · ${l.nome} · ${cliente} · ${processo}`
}

export function Importar() {
  const idArquivo = useId()
  const [arquivo, setArquivo] = useState<{ nome: string; texto: string } | null>(null)
  const [relatorio, setRelatorio] = useState<RelatorioDaImportacao | null>(null)
  const [conferi, setConferi] = useState(false)
  const [gravado, setGravado] = useState<Gravado | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  async function escolher(f: File | undefined) {
    setRelatorio(null)
    setConferi(false)
    setGravado(null)
    setErro('')
    setArquivo(f ? { nome: f.name, texto: await lerTexto(f) } : null)
  }

  async function enviar<T>(caminho: string, corpo: object, feito: (r: T) => void) {
    if (travado.current) return
    travado.current = true
    setEnviando(true)
    setErro('')
    const r = await chamarApi<T>(caminho, { method: 'POST', corpo })
    if (r.ok) feito(r.dados)
    else setErro(r.erro)
    travado.current = false
    setEnviando(false)
  }

  const simular = () =>
    arquivo &&
    enviar<RelatorioDaImportacao>('/importacao/simulacao', { arquivo: arquivo.texto }, (r) => {
      setRelatorio(r)
      setConferi(false)
    })
  const gravar = () =>
    arquivo &&
    relatorio &&
    enviar<Gravado>('/importacao', { arquivo: arquivo.texto, conferido: relatorio.conferido, confirmo: true }, (r) => {
      setGravado(r)
      setRelatorio(null)
    })
  const aGravar = relatorio ? relatorio.clientes.novos + relatorio.processos.novos : 0

  return (
    <main className={styles.pagina}>
      <title>Importar a planilha do escritório · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Importar a planilha do escritório</h1>
      <p className={styles.subtitulo}>Clientes e processos em andamento que o escritório já tem. Nada é gravado antes de você conferir o relatório.</p>

      <section className={styles.cartao} aria-labelledby="planilha">
        <h2 id="planilha" className={styles.cartaoTitulo}>
          A planilha
        </h2>
        <p className={styles.dica}>
          Um arquivo CSV. A primeira linha tem os nomes das colunas: {COLUNAS_DA_PLANILHA.join(', ')}. Só nome e CPF são obrigatórios. Uma linha por processo: o
          mesmo CPF em várias linhas é o mesmo cliente. Datas em dd/mm/aaaa.
        </p>
        <label className={styles.rotulo} htmlFor={idArquivo}>
          Planilha (CSV)
        </label>
        <input id={idArquivo} className={styles.campo} type="file" accept=".csv,text/csv" onChange={(e) => void escolher(e.target.files?.[0])} />
        <div className={styles.acoes}>
          <button type="button" className={styles.botao} disabled={!arquivo || enviando} onClick={() => void simular()}>
            {enviando && !relatorio ? 'simulando…' : 'Simular a importação'}
          </button>
        </div>
      </section>

      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

      {relatorio && (
        <section className={styles.cartao} aria-labelledby="relatorio">
          <h2 id="relatorio" className={styles.cartaoTitulo}>
            Relatório da simulação · {arquivo?.nome}
          </h2>
          <p>
            Clientes: {plural(relatorio.clientes.novos, 'novo', 'novos')} · {plural(relatorio.clientes.jaCadastrados, 'já cadastrado', 'já cadastrados')} (pelo CPF,
            não duplicam)
          </p>
          <p>
            Processos: {plural(relatorio.processos.novos, 'novo', 'novos')} · {plural(relatorio.processos.jaCadastrados, 'já cadastrado', 'já cadastrados')}
          </p>
          {relatorio.colunasIgnoradas.length > 0 && <p className={styles.dica}>Colunas que o importador não lê: {relatorio.colunasIgnoradas.join(', ')}.</p>}
          {relatorio.erros.length > 0 && (
            <>
              <h3 className={styles.rotulo}>Linhas com erro: ficam de fora</h3>
              <ul className={styles.lista} aria-label="Linhas com erro">
                {relatorio.erros.map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha}: {e.motivo}
                  </li>
                ))}
              </ul>
            </>
          )}
          {relatorio.linhas.length > 0 && (
            <>
              <h3 className={styles.rotulo}>O que cada linha vira</h3>
              <ul className={styles.lista} aria-label="O que cada linha vira">
                {relatorio.linhas.map((l) => (
                  <li key={l.linha}>{oQueEntra(l)}</li>
                ))}
              </ul>
            </>
          )}
          {aGravar === 0 ? (
            <p className={styles.dica}>Nada a gravar: nenhum cliente ou processo novo.</p>
          ) : (
            <>
              <label className={styles.escolha}>
                <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} />
                Conferi o relatório: gravar {plural(relatorio.clientes.novos, 'cliente novo', 'clientes novos')} e{' '}
                {plural(relatorio.processos.novos, 'processo novo', 'processos novos')}
                {relatorio.erros.length > 0 ? `; ${deFora(relatorio.erros.length)}` : ''}
              </label>
              <div className={styles.acoes}>
                <button type="button" className={styles.botao} disabled={!conferi || enviando} onClick={() => void gravar()}>
                  {enviando ? 'gravando…' : 'Gravar no portal'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {gravado && (
        <p className={styles.sucesso} role="status">
          ✓ Gravados: {plural(gravado.clientes.novos, 'cliente novo', 'clientes novos')} e {plural(gravado.processos.novos, 'processo novo', 'processos novos')}.
          {gravado.linhasComErro > 0 ? ` ${deFora(gravado.linhasComErro, true).replace(/^a/, 'A')}.` : ''}
        </p>
      )}
    </main>
  )
}
