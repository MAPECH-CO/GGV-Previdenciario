import { useEffect, useId, useState } from 'react'
import { formatarCnj } from '@ggv/campos'
import {
  CompletarAcervo,
  ConferirDesfecho,
  DESFECHOS_DO_ACERVO,
  ROTULO_BENEFICIO,
  ROTULO_DESFECHO_DO_ACERVO,
  TAMANHO_DA_TESE,
  TAMANHO_DA_VARA,
  type Beneficio,
  type ConferenciaDoAcervo,
  type DesfechoDoAcervo,
} from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

type Pendente = ConferenciaDoAcervo['pendentes'][number]
const rotulo = (d: string) => ROTULO_DESFECHO_DO_ACERVO[d as DesfechoDoAcervo] ?? d

/**
 * Um processo do acervo: confere o desfecho lido, ou corrige (GGVP-55 CA7). O desfecho do portal vem com a ficha da IA
 * e a Sênior confere a tese junto (GGVP-41 CA7); sem a ficha, diz que a IA ainda não leu (CA11) e nada trava.
 */
function ProcessoDoLote({ p, aoConferir }: { p: Pendente; aoConferir: (conferencia: ConferenciaDoAcervo, texto: string) => void }) {
  const idCorrecao = useId()
  const idTese = useId()
  const doPortal = p.fonte === 'portal'
  const [corrigindo, setCorrigindo] = useState(false)
  const [correcao, setCorrecao] = useState('')
  const [tese, setTese] = useState(p.ficha?.tese ?? '')
  const [erro, setErro] = useState('')

  async function conferir(desfecho: string) {
    const entrada = ConferirDesfecho.safeParse({ desfecho, ...(doPortal && { tese }) })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escolha o desfecho')
    const r = await chamarApi<ConferenciaDoAcervo>(`/acervo/processos/${p.id}/conferencia`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoConferir(r.dados, desfecho === p.desfechoLido ? 'Desfecho conferido.' : `Desfecho corrigido para ${rotulo(desfecho)}.`)
  }

  return (
    <li className={styles.cartao}>
      <strong>{p.numeroCnj ? formatarCnj(p.numeroCnj) : doPortal ? 'Processo do portal' : 'sem número'}</strong>
      {p.beneficio && <span> · {ROTULO_BENEFICIO[p.beneficio as Beneficio] ?? p.beneficio}</span>}
      <p>Desfecho lido: {rotulo(p.desfechoLido)}</p>
      {p.ficha && (
        <dl aria-label="Ficha do desfecho">
          <dt>Matéria</dt>
          <dd>{p.ficha.materia}</dd>
          <dt>Vara</dt>
          <dd>{p.ficha.vara ?? 'não identificada'}</dd>
          <dt>Resumo</dt>
          <dd>{p.ficha.resumo}</dd>
          <dt>Lição</dt>
          <dd>{p.ficha.licao}</dd>
        </dl>
      )}
      {doPortal && !p.ficha && <p className={styles.dica}>A IA ainda não leu este desfecho; ela tenta de novo sozinha no dia seguinte. Dá para conferir assim mesmo.</p>}
      {doPortal && (
        <>
          <label className={styles.rotulo} htmlFor={idTese}>
            Tese
          </label>
          <input id={idTese} className={styles.campo} value={tese} maxLength={TAMANHO_DA_TESE} onChange={(e) => setTese(e.target.value)} />
          <p className={styles.dica}>Até {TAMANHO_DA_TESE} caracteres, sem doença nem CID. Vazia, o caso fica fora do recorte por tese.</p>
        </>
      )}
      {corrigindo && (
        <>
          <label className={styles.rotulo} htmlFor={idCorrecao}>
            Desfecho correto
          </label>
          <select id={idCorrecao} className={styles.campo} value={correcao} onChange={(e) => setCorrecao(e.target.value)}>
            <option value="">Escolha</option>
            {DESFECHOS_DO_ACERVO.filter((d) => d !== p.desfechoLido).map((d) => (
              <option key={d} value={d}>
                {ROTULO_DESFECHO_DO_ACERVO[d]}
              </option>
            ))}
          </select>
        </>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        {corrigindo ? (
          <button type="button" className={styles.botao} onClick={() => void conferir(correcao)}>
            Salvar a correção
          </button>
        ) : (
          <>
            <button type="button" className={styles.botao} onClick={() => void conferir(p.desfechoLido)}>
              Confere
            </button>
            <button type="button" className={styles.botaoSecundario} onClick={() => setCorrigindo(true)}>
              Corrigir
            </button>
          </>
        )}
      </div>
    </li>
  )
}

type Incompleto = ConferenciaDoAcervo['incompletos'][number]
type Campo = Incompleto['falta'][number]
const ROTULO_DO_CAMPO: Record<Campo, string> = { vara: 'Vara', juiz: 'Juiz', tese: 'Tese' }

/**
 * GGVP-153: a pergunta de um clique. Cada campo que falta mostra o que o portal já conhece; clicar responde. Para um
 * valor novo, a Sênior escreve e confirma. Sem resposta, o processo só fica fora daquele recorte: nada trava.
 */
function FaltaCompletar({ p, conhecidos, aoCompletar }: { p: Incompleto; conhecidos: ConferenciaDoAcervo['conhecidos']; aoCompletar: (c: ConferenciaDoAcervo, texto: string) => void }) {
  const ids = { vara: useId(), juiz: useId(), tese: useId() }
  const [novo, setNovo] = useState<Partial<Record<Campo, string>>>({})
  const [erro, setErro] = useState('')

  async function responder(campo: Campo, valor: string) {
    const entrada = CompletarAcervo.safeParse({ [campo]: valor })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escolha ou escreva o que falta.')
    const r = await chamarApi<ConferenciaDoAcervo>(`/acervo/processos/${p.id}/completar`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoCompletar(r.dados, `${ROTULO_DO_CAMPO[campo]} completada: o processo volta a contar nesse recorte.`)
  }

  return (
    <li className={styles.cartao}>
      <strong>{p.numeroCnj ? formatarCnj(p.numeroCnj) : 'Processo do portal'}</strong>
      {p.beneficio && <span> · {ROTULO_BENEFICIO[p.beneficio as Beneficio] ?? p.beneficio}</span>}
      <p>Desfecho: {rotulo(p.desfecho)}</p>
      {p.falta.map((campo) => (
        <div key={campo}>
          <p className={styles.rotulo}>{ROTULO_DO_CAMPO[campo]}: não identificada</p>
          {conhecidos[campo].length > 0 && (
            <div className={styles.acoes} role="group" aria-label={`${ROTULO_DO_CAMPO[campo]} que o portal conhece`}>
              {conhecidos[campo].map((v) => (
                <button key={v} type="button" className={styles.botaoSecundario} onClick={() => void responder(campo, v)}>
                  {v}
                </button>
              ))}
            </div>
          )}
          <label className={styles.rotulo} htmlFor={ids[campo]}>
            Outra ({ROTULO_DO_CAMPO[campo].toLowerCase()})
          </label>
          <input
            id={ids[campo]}
            className={styles.campo}
            value={novo[campo] ?? ''}
            maxLength={campo === 'tese' ? TAMANHO_DA_TESE : TAMANHO_DA_VARA}
            onChange={(e) => setNovo({ ...novo, [campo]: e.target.value })}
          />
          <div className={styles.acoes}>
            <button type="button" className={styles.botao} onClick={() => void responder(campo, novo[campo] ?? '')}>
              Usar esta {ROTULO_DO_CAMPO[campo].toLowerCase()}
            </button>
          </div>
        </div>
      ))}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
    </li>
  )
}

/**
 * Conferir desfechos do lote (GGVP-55 CA7): a Sênior confere ou corrige o desfecho lido de cada processo do acervo.
 * Só o conferido entra nas contas da jurimetria; os outros ficam no acervo para consulta, e nada trava. GGVP-41: os
 * desfechos do portal entram aqui com a ficha e a tese.
 */
export function ConferirAcervo() {
  const [c, setC] = useState<ConferenciaDoAcervo | null>(null)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<ConferenciaDoAcervo>('/acervo/conferencia').then((r) => (r.ok ? setC(r.dados) : setErro(r.erro)))
  }, [])

  function aoConferir(nova: ConferenciaDoAcervo, texto: string) {
    setC(nova)
    setFeito(texto)
  }

  return (
    <main className={styles.pagina}>
      <title>Conferir desfechos do lote · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Conferir desfechos do lote</h1>
      {c && (
        <p className={styles.subtitulo}>
          Esperando conferência: {c.pendentes.length} · Já conferidos: {c.conferidos}. Só os conferidos entram nas contas da jurimetria.
        </p>
      )}
      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {c && c.pendentes.length === 0 && <p className={styles.dica}>Nenhum desfecho esperando conferência.</p>}
      {c && c.pendentes.length > 0 && (
        <ul className={styles.lista} aria-label="Desfechos para conferir">
          {c.pendentes.map((p) => (
            <ProcessoDoLote key={p.id} p={p} aoConferir={aoConferir} />
          ))}
        </ul>
      )}
      {c && c.incompletos.length > 0 && (
        <section aria-label="Falta completar">
          <h2 className={styles.cartaoTitulo}>Falta completar</h2>
          <p className={styles.dica}>Processos conferidos sem vara, juiz ou tese ficam fora desse recorte da Gestão até alguém completar.</p>
          <ul className={styles.lista}>
            {c.incompletos.map((p) => (
              <FaltaCompletar key={p.id} p={p} conhecidos={c.conhecidos} aoCompletar={aoConferir} />
            ))}
          </ul>
        </section>
      )}
      <p className={styles.dica}>Os não conferidos ficam no acervo para consulta, fora das contas. Nada trava.</p>
    </main>
  )
}
